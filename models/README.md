# /models — 3D Ship Model Files

Drop downloaded ship model files here. The game loads them automatically if present,
falling back to the built-in procedural geometry if a file is missing.

## Supported formats

- `.glb` — preferred (binary GLTF, single file, includes materials)
- `.gltf` — alternative (JSON GLTF, may have separate texture files)
- `.obj` — supported (requires matching `.mtl` file in same folder)

## Expected filenames

| Ship                      | Filename                        |
|---------------------------|---------------------------------|
| USS Defiant NX-74205      | `defiant.glb`                   |
| USS Enterprise NCC-1701-E | `enterprise_e.glb`              |
| K't'inga Battle Cruiser   | `ktinga.glb`                    |
| Vor'cha Attack Cruiser    | `vor_cha.glb`                   |
| Romulan Bird-of-Prey      | `romulan_bop.glb`               |
| D'Deridex Warbird         | `romulan_warbird.glb`           |
| Cardassian Scout          | `cardassian_scout.glb`          |
| Galor-class Warship       | `galor_class.glb`               |
| Jem'Hadar Attack Ship     | `jem_hadar_fighter.glb`         |
| Jem'Hadar Battle Cruiser  | `jem_hadar_battleship.glb`      |
| Borg Probe                | `borg_probe.glb`                |

## Where to get models (no account required)

- **TrekMeshes.eu** — https://trekmeshes.eu/download/all
- **Sci-Fi 3D** — https://scifi3d.com/category/3d-models/
- **Open3DModel** — https://open3dmodel.com/3d-models/trek
- **Cults3D** — https://cults3d.com/en/tags/star+trek

## Converting OBJ → GLB (if needed)

1. Open **Blender** (free — blender.org)
2. File → Import → Wavefront (.obj) — select your file
3. File → Export → glTF 2.0 (.glb/.gltf)
4. Choose **GLB** format, click Export
5. Rename to match the filename table above and drop it here

## Notes

- Scale doesn't matter — the loader normalises each model to fit the scene
- Orientation doesn't matter — the loader auto-corrects facing direction
- Models are non-commercial fan use, covered by the game's CBS/Paramount disclaimer
