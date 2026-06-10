# Mastercard Greenspace Navigator

Static GitHub Pages package for the Mastercard cybersecurity greenspace prototype.

## Publish With GitHub Pages

1. Create a new GitHub repository.
2. Add everything in this folder to the repository root.
3. Commit and push to the `main` branch.
4. In GitHub, go to `Settings` -> `Pages`.
5. Under `Build and deployment`, choose either:
   - `GitHub Actions`, using the included workflow, or
   - `Deploy from a branch`, then choose `main` and `/root`.

The site entry point is `index.html`. It is fully self-contained and does not need a build step.

## Local Preview

Open `index.html` in a browser, or run a simple static server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
