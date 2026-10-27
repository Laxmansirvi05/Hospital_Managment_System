# CareRoute animated icon system

The shared icon factory in `public/js/h.js` owns the semantic registry and emits the existing inline SVG as a guaranteed static fallback. `public/css/base.css` adds short, interaction-led motion to those vectors. This keeps the bundle dependency-free, avoids layout shift, and allows the same icon to be reused everywhere.

The visual direction was reviewed against [LottieFiles](https://lottiefiles.com/) and the supplied [Flaticon 3D animated icon reference](https://www.flaticon.com/free-animated-icon/3d_11700788). Search links for each semantic icon are recorded in `registry.json` for future asset replacement if a compatible, approved Lottie or Flaticon download is selected.

No third-party asset is hotlinked or copied into the product without a confirmed license. The current implementation uses original CareRoute inline vectors with CSS motion and therefore has no third-party attribution requirement. If a Flaticon asset is later selected, keep its author and attribution text in the asset log and retain the static SVG fallback.

## Asset log

- Selected product format: inline SVG plus CSS keyframes; lightweight, locally rendered, and supported by every current browser target.
- Creator: CareRoute implementation, using the existing project vector set.
- License: project-owned vector implementation; no external asset license is being asserted.
- Attribution: none currently required for the local implementation.
- External references reviewed: Flaticon animated-icon library and LottieFiles library; the supplied Flaticon 3D asset is recorded as a visual reference only and is not reused because it is unrelated to a healthcare feature.
- Unsupported external assets: no approved Flaticon or LottieFiles file was downloaded into this repository, so there are no third-party animation files to verify or attribute yet.
