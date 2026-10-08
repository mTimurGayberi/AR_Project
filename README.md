# PJATK LABXR AR Project

This is a WebAR project built with Zapworks Mattercraft for the LABXR course.

## Project Structure

- `src/GameManager.ts`: The central Singleton that controls the game logic across all scenes.
- `src/QuestManager.ts`: Handles the Sensei's quests, tracking progress, and completion states.
- `src/SaveManager.ts`: Handles saving and loading the game state via browser `localStorage`.
- `assets/`: (To be added) This is where all 3D models (.gltf/.glb), audio, and images will go.

## Workflow for the Lead Programmer

1. Receive `.gltf` or `.glb` files from the art team.
2. Place them into the `assets/models` folder.
3. Open `app.mattercraft.io` in Google Chrome.
4. Select **"Open Folder"** and choose this repository's folder.
5. Drag and drop assets into the `.zcomp` scenes and link them to the logic in `src/`.
6. Test locally or in the Mattercraft preview.
7. Commit and push changes to GitHub.

## Testing Locally
To test backend logic directly from your console, you can run a local dev server (if Parcel/Mattercraft CLI is configured) or just preview it inside the Mattercraft Web Editor.

*Save data is stored in the browser. If you need to wipe progress during testing, uncomment the `clearSave()` line in `index.ts`.*
