// utils/cloudinaryHelper.js
import cloudinary from "../lib/cloudinary.js";

/**
 * Ambil public_id dari Cloudinary secure_url, contoh:
 * https://res.cloudinary.com/demo/image/upload/v1699999999/komunitas/posts/post-123.jpg
 *  -> "komunitas/posts/post-123"
 *
 * Aman dipakai untuk value lama (path lokal "/uploads/...") -> akan return null,
 * sehingga proses hapus file lama otomatis di-skip tanpa error.
 */
export function extractPublicId(url) {
    if (!url || typeof url !== "string") return null;
    if (!url.includes("res.cloudinary.com") && !url.includes("/upload/")) return null;

    try {
        const afterUpload = url.split("/upload/")[1];
        if (!afterUpload) return null;

        // Buang query string kalau ada
        const withoutQuery = afterUpload.split("?")[0];
        // Buang segment versi (v1699999999/)
        const withoutVersion = withoutQuery.replace(/^v\d+\//, "");
        // Buang ekstensi file (.jpg, .png, .pdf, .mp4, dst)
        const withoutExt = withoutVersion.replace(/\.[a-zA-Z0-9]+$/, "");

        return withoutExt || null;
    } catch (err) {
        return null;
    }
}

/**
 * Hapus file di Cloudinary berdasarkan URL yang tersimpan di database.
 * Jika resourceType tidak diketahui, akan dicoba berurutan: image -> video -> raw.
 *
 * @param {string} url - secure_url yang tersimpan di database
 * @param {"image"|"video"|"raw"|null} resourceType - tipe resource jika sudah diketahui
 * @returns {Promise<object|null>} hasil destroy dari Cloudinary, atau null jika tidak ada yang dihapus
 */
export async function deleteCloudinaryFile(url, resourceType = null) {
    const publicId = extractPublicId(url);
    if (!publicId) return null;

    const typesToTry = resourceType ? [resourceType] : ["image", "video", "raw"];

    for (const type of typesToTry) {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: type,
                invalidate: true,
            });
            if (result && result.result === "ok") {
                return result;
            }
        } catch (err) {
            console.error(`Cloudinary destroy error (${type}):`, err.message);
        }
    }

    return null;
}

/**
 * Hapus banyak file sekaligus. Menerima array of { url, resourceType }.
 */
export async function deleteManyCloudinaryFiles(items = []) {
    const results = await Promise.all(
        items.map(({ url, resourceType }) => deleteCloudinaryFile(url, resourceType))
    );
    return results;
}