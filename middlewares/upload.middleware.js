// middlewares/upload.middleware.js
import multer from "multer";
import cloudinaryStorage from "../utils/cloudinaryStorage.js";

// Helper untuk generate public_id yang mirip dengan skema filename lama
const makePublicId = (prefix) =>
    `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

// ============================================================
// STORAGE: Community logo / banner / profile picture (images)
// ============================================================
const imageStorage = cloudinaryStorage({
    params: async (req, file) => {
        let folder = "komunitas/misc";
        let prefix = "file";

        if (file.fieldname === "logo") {
            folder = "komunitas/communities";
            prefix = "logo";
        } else if (file.fieldname === "banner") {
            folder = "komunitas/communities";
            prefix = "banner";
        } else if (file.fieldname === "profile_picture") {
            folder = "komunitas/profiles";
            prefix = "profile";
        }

        return {
            folder,
            public_id: makePublicId(prefix),
            allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
            resource_type: "image",
        };
    },
});

// Filter file - hanya gambar
const fileFilter = (req, file, cb) => {
    console.log("🧪 [fileFilter/image] field:", file.fieldname, "| originalname:", file.originalname, "| mimetype:", file.mimetype);
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        console.log("✅ [fileFilter/image] lolos");
        return cb(null, true);
    } else {
        console.log("❌ [fileFilter/image] ditolak. extname ok?", extname, "| mimetype ok?", mimetype);
        cb(new Error("Hanya file gambar yang diizinkan (jpeg, jpg, png, gif, webp)"));
    }
};

// ============================================================
// STORAGE: Post media (images & videos)
// ============================================================
const postStorage = cloudinaryStorage({
    params: async (req, file) => {
        const isVideo = file.mimetype.startsWith("video");
        return {
            folder: "komunitas/posts",
            public_id: makePublicId("post"),
            resource_type: isVideo ? "video" : "image",
        };
    },
});

// Filter untuk post media (gambar & video)
const postFileFilter = (req, file, cb) => {
    console.log("🧪 [fileFilter/post] field:", file.fieldname, "| originalname:", file.originalname, "| mimetype:", file.mimetype);
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        console.log("✅ [fileFilter/post] lolos");
        return cb(null, true);
    } else {
        console.log("❌ [fileFilter/post] ditolak. extname ok?", extname, "| mimetype ok?", mimetype);
        cb(new Error("Hanya file gambar (jpeg, jpg, png, gif, webp) dan video (mp4, mov, avi) yang diizinkan"));
    }
};

// Upload middleware untuk post media (multiple files)
const uploadPostMedia = multer({
    storage: postStorage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB untuk video
    },
    fileFilter: postFileFilter
});

export const handleUploadError = (err, req, res, next) => {
    if (err) {
        console.log("🧪 [handleUploadError] ada error masuk. name:", err.name, "| message:", err.message, "| code:", err.code);
    }

    if (err instanceof multer.MulterError) {
        let message = "Upload gagal";
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = "Ukuran file terlalu besar";
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = "Field file tidak sesuai dengan yang diharapkan";
        }
        console.log("❌ [handleUploadError] MulterError:", message);
        return res.status(400).json({ success: false, message });
    }

    if (err) {
        // Error dari fileFilter atau dari cloudinaryStorage._handleFile
        console.log("❌ [handleUploadError] Error lain (fileFilter/Cloudinary):", err.message);
        return res.status(400).json({ success: false, message: err.message });
    }

    console.log("✅ [handleUploadError] tidak ada error, lanjut ke controller. req.file:", req.file ? req.file.filename : null, "| req.files:", req.files ? Object.keys(req.files).length || req.files.length : null);
    next();
};

// Upload middleware (images: logo, banner, profile_picture)
const upload = multer({
    storage: imageStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
});

// Middleware untuk upload logo (single file)
export const uploadCommunityLogo = upload.single("logo");

// Middleware untuk upload banner (single file)
export const uploadCommunityBanner = upload.single("banner");

// Middleware untuk upload profile picture
export const uploadProfilePicture = upload.single("profile_picture");

// Middleware untuk upload multiple (logo + banner sekaligus)
export const uploadCommunityMedia = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]);

export const uploadPostImages = uploadPostMedia.array("media", 10); // Max 10 files
export const uploadSinglePostImage = uploadPostMedia.single("media");

// ============================================================
// STORAGE: Donation proof / goods photo (images & PDF)
// ============================================================
const donationStorage = cloudinaryStorage({
    params: async (req, file) => {
        const isPdf = file.mimetype === "application/pdf";
        return {
            folder: "komunitas/donations",
            public_id: makePublicId("donation"),
            resource_type: isPdf ? "raw" : "image",
        };
    },
});

// Donation file filter
const donationFileFilter = (req, file, cb) => {
    console.log("🧪 [fileFilter/donation] field:", file.fieldname, "| originalname:", file.originalname, "| mimetype:", file.mimetype);
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        console.log("✅ [fileFilter/donation] lolos");
        return cb(null, true);
    } else {
        console.log("❌ [fileFilter/donation] ditolak. extname ok?", extname, "| mimetype ok?", mimetype);
        cb(new Error("Hanya file gambar (jpeg, jpg, png, gif, webp) dan PDF yang diizinkan"));
    }
};

// Donation upload middleware
const uploadDonation = multer({
    storage: donationStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: donationFileFilter
});

export const uploadDonationProof = uploadDonation.single("proof_image");
export const uploadDonationGoodsPhoto = uploadDonation.single("goods_photo");

// ============================================================
// STORAGE: Distribution evidence (images, multiple)
// ============================================================
const distributionStorage = cloudinaryStorage({
    params: async (req, file) => ({
        folder: "komunitas/distributions",
        public_id: makePublicId("evidence"),
        resource_type: "image",
    }),
});

export const uploadDistributionEvidence = multer({
    storage: distributionStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
}).array("evidence_images", 10);