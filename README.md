# PJATK LABXR AR Project

This is a WebAR project built with Zapworks Mattercraft for the LABXR course.

## Project Structure

- `src/GameManager.ts`: The central Singleton that controls the game logic across all scenes.
- `src/QuestManager.ts`: Handles the Sensei's quests, tracking progress, and completion states.
- `src/SaveManager.ts`: Handles saving and loading the game state via browser `localStorage`.
- `assets/`: (To be added) This is where all 3D models (.gltf/.glb), audio, and images will go.

## Workflow for Artists (Image Tracking)

Since our 10 mini-games are spread across different physical rooms, we are using **Image Tracking** to anchor the 3D models to reality. 

1. **Create the Markers:** For each mini-game, design a unique 2D image (like a poster, magical rune, or painting).
2. **Deliver the Files:** Provide the Lead Programmer with both the 2D image (`.jpg` or `.png`) AND the 3D assets (`.glb` or `.gltf`) for that specific mini-game.
3. **Physical Placement:** The 2D images must be printed out and placed in the real-world physical rooms. 
4. **Design Consideration:** When creating the 3D animations and models, remember they will spawn directly on top of the 2D printed marker when the player scans it with their phone!

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
