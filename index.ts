import { initialize } from "@zcomponent/three";
import { default as Scene } from "./Scene.zcomp";
import { gameManager } from "./src/GameManager";

// --- TEST LOGIC ---
console.log("--- STARTING BACKEND TEST ---");

// 1. Check if we loaded a saved game (if the user refreshes the page)
let quest = gameManager.questManager.getQuest('q_intro');
console.log(`Initial Quest State: Progress = ${quest?.currentProgress}, Completed = ${quest?.isCompleted}`);

// 2. Simulate the player making progress (e.g., they tapped a UI button)
if (quest && !quest.isCompleted) {
    console.log("Simulating player finding the scroll...");
    gameManager.questManager.updateProgress('q_intro', 1);
    
    // 3. Save the game automatically after progress
    gameManager.saveGame();
    
    // 4. Check state again
    quest = gameManager.questManager.getQuest('q_intro');
    console.log(`New Quest State: Progress = ${quest?.currentProgress}, Completed = ${quest?.isCompleted}`);
} else {
    console.log("Quest was already completed from a previous save!");
    // Optional: Uncomment the line below to reset the save for testing purposes
    // gameManager.saveManager.clearSave();
}
console.log("--- END BACKEND TEST ---");

initialize(Scene, {}, {
    launchButton: document.getElementById('launchButton')
});
