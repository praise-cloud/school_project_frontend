# AftaClass Frontend

The AftaClass frontend is a Vue 3 single-page app for browsing after-school lessons, sorting and filtering the catalogue, adding multiple seats to a cart, and checking out. It calls the Express API with the browser's `fetch` API.

## Live links

- **GitHub repository:** <https://github.com/praise-cloud/school_project_frontend>
- **GitHub Pages:** <https://praise-cloud.github.io/school_project_frontend/>
- **Backend API:** <https://school-project-backend-xlih.onrender.com/api/lessons>

The API base URL is public browser configuration in `index.js`; it is not a secret and cannot be loaded from the backend's `.env` file by a static GitHub Pages site.

## Run locally

The frontend has no bundler or package install step. Start the backend with MongoDB configured, then serve this folder using VS Code Live Server on port 5500 or 5501. The frontend uses the local API at `http://127.0.0.1:3002/api` when opened from localhost.

## GitHub Pages deployment

In the frontend repository, open **Settings → Pages** and choose **Deploy from a branch**. Select branch `main` and folder `/(root)`, then save. The frontend files, including `index.html`, are at this repository's root, so do not select `/frontend`. Push changes to `main` to publish them. The project Pages URL is listed above.

## AI-use acknowledgment

GitHub Copilot was used as an assistive tool to review the existing code and help implement selected frontend changes and documentation. I am responsible for understanding and explaining the submitted work. Make sure this note matches your actual use and complete the coursework's required GenAI-use declaration.
