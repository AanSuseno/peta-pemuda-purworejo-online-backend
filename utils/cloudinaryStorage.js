// utils/cloudinaryStorage.js
import cloudinary from "../lib/cloudinary.js";

/**
 * Custom multer StorageEngine yang upload langsung ke Cloudinary lewat
 * cloudinary.uploader.upload_stream (Cloudinary SDK v2), tanpa perlu
 * paket "multer-storage-cloudinary" (yang peer-dependency-nya masih
 * cloudinary v1 dan bentrok dengan cloudinary v2).
 *
 * Pemakaian sama seperti multer-storage-cloudinary:
 *   const storage = cloudinaryStorage({
 *     params: async (req, file) => ({
 *       folder: "komunitas/posts",
 *       public_id: "post-123",
 *       resource_type: "image", // atau "video" / "raw" / "auto"
 *       allowed_formats: ["jpg","png"], // opsional
 *     }),
 *   });
 */
class CloudinaryStorage {
    constructor(opts = {}) {
        if (typeof opts.params !== "function") {
            throw new Error("cloudinaryStorage membutuhkan opsi `params` berupa async function(req, file)");
        }
        this.paramsFn = opts.params;
    }

    async _handleFile(req, file, cb) {
        try {
            console.log("☁️ [cloudinaryStorage] _handleFile mulai untuk field:", file.fieldname, "| originalname:", file.originalname, "| mimetype:", file.mimetype);

            const params = await this.paramsFn(req, file);
            console.log("☁️ [cloudinaryStorage] params dari config:", params);

            if (params.allowed_formats) {
                const ext = (file.originalname.split(".").pop() || "").toLowerCase();
                console.log("☁️ [cloudinaryStorage] cek ekstensi:", ext, "| allowed:", params.allowed_formats);
                if (!params.allowed_formats.map((f) => f.toLowerCase()).includes(ext)) {
                    console.log("❌ [cloudinaryStorage] ekstensi ditolak:", ext);
                    return cb(new Error(`Format file .${ext} tidak diizinkan`));
                }
            }

            const uploadOptions = {
                folder: params.folder,
                public_id: params.public_id,
                resource_type: params.resource_type || "auto",
                use_filename: false,
                unique_filename: false,
                overwrite: false,
            };
            console.log("☁️ [cloudinaryStorage] uploadOptions dikirim ke Cloudinary:", uploadOptions);

            const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) {
                    console.error("❌ [cloudinaryStorage] Cloudinary upload_stream ERROR:", error);
                    return cb(error);
                }
                console.log("✅ [cloudinaryStorage] Upload sukses. secure_url:", result.secure_url, "| public_id:", result.public_id, "| bytes:", result.bytes);
                cb(null, {
                    // Field-field ini dipakai oleh controller, sama seperti
                    // multer diskStorage sebelumnya (path/filename/size/mimetype):
                    path: result.secure_url,       // URL Cloudinary -> disimpan ke DB
                    filename: result.public_id,    // public_id -> dipakai utk hapus nanti
                    size: result.bytes,
                    mimetype: file.mimetype,
                    resource_type: result.resource_type,
                    format: result.format,
                    cloudinaryResult: result,
                });
            });

            file.stream.on("error", (streamErr) => {
                console.error("❌ [cloudinaryStorage] req file.stream ERROR:", streamErr);
            });

            uploadStream.on("error", (streamErr) => {
                console.error("❌ [cloudinaryStorage] upload_stream (writable) ERROR:", streamErr);
            });

            file.stream.pipe(uploadStream);
        } catch (err) {
            console.error("❌ [cloudinaryStorage] _handleFile exception:", err);
            cb(err);
        }
    }

    _removeFile(req, file, cb) {
        if (!file.filename) return cb(null);
        console.log("🗑️ [cloudinaryStorage] _removeFile:", file.filename);
        cloudinary.uploader
            .destroy(file.filename, { resource_type: file.resource_type || "image" })
            .then((result) => {
                console.log("🗑️ [cloudinaryStorage] _removeFile hasil:", result);
                cb(null);
            })
            .catch((err) => {
                console.error("❌ [cloudinaryStorage] _removeFile ERROR:", err);
                cb(err);
            });
    }
}

export default function cloudinaryStorage(opts) {
    return new CloudinaryStorage(opts);
}