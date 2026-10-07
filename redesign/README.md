# Portfolio redesign hand-off

Everything the build needs. Open the files in design/ in a browser to see each screen.

## design/
| File | Screen |
|---|---|
| Main.html | Map home (desktop, 1440 x 900) |
| Mobile.html | Map home (phone, 390 wide) |
| MainContact.html | Contact panel open over the map |
| DetailUnify.html, DetailCubic.html, DetailLens.html | The three destinations |
| DetailTurtle.html, DetailAmenity.html, DetailPipeline.html, DetailNutrifit.html | Other project pages |
| ProfileOne.html | Profile (one page, tabs jump to sections) |

The mockups are absolutely positioned at a fixed 1440 x 900 canvas. Rebuild them as responsive layouts; use the mockups for proportions, spacing, colours and copy, not for literal pixel positions.

## content.json
Source of truth for every fact, number and link. Where a mockup and content.json disagree, content.json wins (for example the Unify blurb now says web lead).

## assets/
All images, the sky (sky2.webp, plus sky-source-2880.jpg to make other sizes), orbit lines (orbits2.svg), ring frame (frame.svg), photo (profile-hd.webp), and the public resume (resume.pdf, no phone number).

## Known fixes to apply during the build
1. Route line crosses the Unify and Lens description text: bend or mask it.
2. Orbit lines show through the About me and Cubic text: soft dark glow behind text.
3. A dotted orbit runs through the Amenity Recommender label: move it.
4. Other projects row: 120px rings, about 24px apart, names 14px on one line, tags 12px, about 20px lower.
5. Lens chip: keep VALIDATED only after the full labelled set is run.
