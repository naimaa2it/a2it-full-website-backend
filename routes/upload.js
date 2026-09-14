const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  upload,
  uploadImageByType,
  uploadEmployeeImage,
  uploadBlogImage,
  uploadPortfolioImage,
  uploadServiceImage,
  uploadClientLogoImage,
  uploadSettingsImage,
  listPortfolioResources,
  listMediaResources,
  listPublicGalleryResources,
  deletePortfolioResource,
} = require("../controllers/uploadController");

const router = express.Router();

router.post(
  "/image/:type",
  authMiddleware,
  upload.single("image"),
  uploadImageByType,
);
router.post(
  "/employees",
  authMiddleware,
  upload.single("image"),
  uploadEmployeeImage,
);
router.post("/blogs", authMiddleware, upload.single("image"), uploadBlogImage);
router.post(
  "/portfolio",
  authMiddleware,
  upload.single("image"),
  uploadPortfolioImage,
);
router.post(
  "/services",
  authMiddleware,
  upload.single("image"),
  uploadServiceImage,
);
router.post(
  "/clients",
  authMiddleware,
  upload.single("image"),
  uploadClientLogoImage,
);
router.post(
  "/settings",
  authMiddleware,
  upload.single("image"),
  uploadSettingsImage,
);
router.get("/portfolio/list", authMiddleware, listPortfolioResources);
router.get("/media/list", authMiddleware, listMediaResources);
// Public: powers the About page "Company Gallery" (no auth required).
router.get("/gallery", listPublicGalleryResources);
router.delete("/portfolio", authMiddleware, deletePortfolioResource);

module.exports = router;
