# Sponsor logos

Drop sponsor logos here as **SVG** files, then add each one to the static
sponsors block in `index.html` (search for `oa-sponsors-logos`). No data file,
no build step - the markup is the list.

## Adding a logo

1. Save the logo as an SVG in this folder, e.g. `acme.svg`.
2. Add an entry inside `<div class="oa-sponsors-logos">` in `index.html`:

   ```html
   <a class="oa-sponsor-link" href="https://acme.example" target="_blank" rel="noopener" title="ACME Corp"><img class="oa-sponsor-logo" src="src/sponsors/acme.svg" alt="ACME Corp" loading="lazy"/></a>
   ```

   No link? Use the bare `<img>` without the `<a>` wrapper. `alt`/`title`
   carry the accessible name and tooltip.

## Styling notes

- Logos are capped at **40px tall** (width scales intrinsically, max 160px).
- They render **muted + greyscale**, going full-colour on hover. Adjust in the
  `.oa-sponsor-logo` rule in `index.html` if you want them always full-colour.
