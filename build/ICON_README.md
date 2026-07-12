# OpenX Build Resources

## Required Icon

Place `icon.ico` in this directory before running the build.

### Icon Requirements
- Format: Windows ICO (multi-resolution)
- Minimum size: 256x256
- Recommended sizes: 16, 32, 48, 64, 128, 256
- Must be a valid Windows executable icon

### Generating an Icon
If you have a PNG or other image format, use a tool like:
- `png2ico` (npm package)
- `iconverter` (ImageMagick)
- Online ICO generators

Example using ImageMagick:
```bash
magick convert input.png -define icon:auto-resize="16,32,48,64,128,256" icon.ico
```

Example using png2ico:
```bash
npx png2ico icon.png -o icon.ico
```