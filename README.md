# PJATK LABXR AR Project

This is a WebAR project built with Zapworks Mattercraft for the LABXR course.

## Project Structure

- `src/GameManager.ts`: The central Singleton that controls the game logic across all scenes.
- `src/QuestManager.ts`: Handles the Sensei's quests, tracking progress, and completion states.
- `src/SaveManager.ts`: Handles saving and loading the game state via browser `localStorage`.
- `assets/`: (To be added) This is where all 3D models (.gltf/.glb), audio, and images will go.

## Workflow for the Lead Programmer

1. Receive `.gltf` or `.glb` files from the art team (via GitHub, Discord, or Google Drive).
2. Open `app.mattercraft.io` in Microsoft Edge and open the main Cloud Project.
3. Upload the 3D assets directly into the Mattercraft Web Editor and arrange the `.zcomp` scenes.
4. Write and link TypeScript logic in the web editor (or code locally in VS Code and paste it in).
5. **End of Day Backup:** Go to Mattercraft Settings -> **Export project as ZIP**.
6. Extract the downloaded ZIP into this local Git repository folder (`c:\Dev\gitHubClones\AR_Project`), overwriting old files.
7. Open VS Code, commit the changes, and push to GitHub so the whole team has the latest backup!

## Testing
Test the game directly inside the Mattercraft Web Editor by clicking **Live Preview**.
*Save data is stored in the browser. If you need to wipe progress during testing, uncomment the `clearSave()` line in `index.ts`.*
