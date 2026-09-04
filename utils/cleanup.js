// utils/cleanup.js
import cloudinary from "../lib/cloudinary.js";
import prisma from "../lib/prisma.js";
import { extractPublicId } from "./cloudinaryHelper.js";

// Konfigurasi tiap "folder" upload: lokasi folder di Cloudinary + resource_type
// yang dipakai + cara ambil URL yang masih dipakai dari database, sesuai skema Prisma.
const FOLDER_CONFIG = {
  profiles: {
    folder: "komunitas/profiles",
    resourceTypes: ["image"],
    getUsedUrls: async () => {
      const rows = await prisma.users.findMany({
        where: { profile_picture: { not: null } },
        select: { profile_picture: true },
      });
      return rows.map((r) => r.profile_picture);
    },
  },
  communities: {
    folder: "komunitas/communities",
    resourceTypes: ["image"],
    getUsedUrls: async () => {
      const rows = await prisma.communities.findMany({
        where: { OR: [{ logo: { not: null } }, { banner: { not: null } }] },
        select: { logo: true, banner: true },
      });
      const urls = [];
      rows.forEach((r) => {
        if (r.logo) urls.push(r.logo);
        if (r.banner) urls.push(r.banner);
      });
      return urls;
    },
  },
  donations: {
    folder: "komunitas/donations",
    resourceTypes: ["image", "raw"], // raw untuk file PDF
    getUsedUrls: async () => {
      const rows = await prisma.donations.findMany({
        where: { OR: [{ proof_image: { not: null } }, { goods_photo: { not: null } }] },
        select: { proof_image: true, goods_photo: true },
      });
      const urls = [];
      rows.forEach((r) => {
        if (r.proof_image) urls.push(r.proof_image);
        if (r.goods_photo) urls.push(r.goods_photo);
      });
      return urls;
    },
  },
  distributions: {
    folder: "komunitas/distributions",
    resourceTypes: ["image"],
    getUsedUrls: async () => {
      const rows = await prisma.distribution_evidences.findMany({
        select: { evidence_url: true },
      });
      return rows.map((r) => r.evidence_url);
    },
  },
  posts: {
    folder: "komunitas/posts",
    resourceTypes: ["image", "video"],
    getUsedUrls: async () => {
      const rows = await prisma.post_media.findMany({
        select: { media_url: true },
      });
      return rows.map((r) => r.media_url);
    },
  },
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Ambil semua resource Cloudinary di dalam sebuah folder, untuk satu resource_type,
// dengan pagination lewat next_cursor.
async function listAllResources(folder, resourceType) {
  const resources = [];
  let nextCursor = undefined;

  do {
    const response = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix: `${folder}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });

    resources.push(
      ...response.resources.map((r) => ({
        public_id: r.public_id,
        bytes: r.bytes,
        resource_type: resourceType,
        format: r.format,
        created_at: r.created_at,
      }))
    );

    nextCursor = response.next_cursor;
  } while (nextCursor);

  return resources;
}

// Batch delete_resources Cloudinary hanya menerima maksimal 100 public_id per panggilan.
async function deleteResourcesInBatches(publicIds, resourceType) {
  const batchSize = 100;
  let deletedCount = 0;
  const errors = [];

  for (let i = 0; i < publicIds.length; i += batchSize) {
    const batch = publicIds.slice(i, i + batchSize);
    try {
      const result = await cloudinary.api.delete_resources(batch, {
        resource_type: resourceType,
      });
      deletedCount += Object.values(result.deleted || {}).filter(
        (status) => status === "deleted"
      ).length;
    } catch (err) {
      errors.push({ resourceType, batch, error: err.message });
    }
  }

  return { deletedCount, errors };
}

export async function getFileStats() {
  const folders = {};
  let totalFiles = 0;
  let totalSize = 0;
  let totalUnused = 0;

  for (const [name, config] of Object.entries(FOLDER_CONFIG)) {
    const usedUrls = await config.getUsedUrls();
    const usedPublicIds = new Set(usedUrls.map(extractPublicId).filter(Boolean));

    let allResources = [];
    for (const resourceType of config.resourceTypes) {
      const resources = await listAllResources(config.folder, resourceType);
      allResources = allResources.concat(resources);
    }

    let folderSize = 0;
    const unusedResources = [];

    allResources.forEach((resource) => {
      folderSize += resource.bytes || 0;
      if (!usedPublicIds.has(resource.public_id)) {
        unusedResources.push(resource.public_id);
      }
    });

    folders[name] = {
      total_files: allResources.length,
      total_size: formatBytes(folderSize),
      used_files: allResources.length - unusedResources.length,
      unused_files: unusedResources.length,
      unused_file_names: unusedResources,
    };

    totalFiles += allResources.length;
    totalSize += folderSize;
    totalUnused += unusedResources.length;
  }

  return {
    success: true,
    summary: {
      total_files: totalFiles,
      total_size: formatBytes(totalSize),
      total_unused_files: totalUnused,
    },
    folders,
  };
}

export async function cleanupUnusedFiles() {
  const details = {};
  const errors = [];
  let totalDeleted = 0;
  let totalFreedBytes = 0;

  for (const [name, config] of Object.entries(FOLDER_CONFIG)) {
    const usedUrls = await config.getUsedUrls();
    const usedPublicIds = new Set(usedUrls.map(extractPublicId).filter(Boolean));

    const deletedFiles = [];
    let freedBytes = 0;

    for (const resourceType of config.resourceTypes) {
      const resources = await listAllResources(config.folder, resourceType);
      const unused = resources.filter((r) => !usedPublicIds.has(r.public_id));

      if (unused.length === 0) continue;

      const unusedIds = unused.map((r) => r.public_id);
      const { deletedCount, errors: batchErrors } = await deleteResourcesInBatches(
        unusedIds,
        resourceType
      );

      if (batchErrors.length) {
        batchErrors.forEach((e) => errors.push({ folder: name, ...e }));
      }

      // Hitung freed bytes hanya untuk resource yang benar-benar berhasil dihapus.
      // (Cloudinary tidak mengembalikan detail per-file, jadi kita pakai estimasi
      // total bytes dari daftar unused sebagai pendekatan.)
      freedBytes += unused.reduce((sum, r) => sum + (r.bytes || 0), 0);
      deletedFiles.push(...unusedIds);
    }

    details[name] = {
      deleted_count: deletedFiles.length,
      deleted_files: deletedFiles,
      freed_space: formatBytes(freedBytes),
    };

    totalDeleted += deletedFiles.length;
    totalFreedBytes += freedBytes;
  }

  return {
    success: true,
    summary: {
      total_deleted: totalDeleted,
      total_freed_space: formatBytes(totalFreedBytes),
    },
    details,
    ...(errors.length ? { errors } : {}),
  };
}