export class SaveManager {
    private saveKey: string = 'AR_Project_Save_Data';

    constructor(saveKeyPrefix?: string) {
        if (saveKeyPrefix) {
            this.saveKey = `${saveKeyPrefix}_Save_Data`;
        }
    }

    saveGame(state: any) {
        try {
            const serializedState = JSON.stringify(state);
            // Using localStorage for WebAR. It persists across sessions in the browser.
            localStorage.setItem(this.saveKey, serializedState);
            console.log('Game saved successfully.');
        } catch (error) {
            console.error('Failed to save game:', error);
        }
    }

    loadGame(): any | null {
        try {
            const serializedState = localStorage.getItem(this.saveKey);
            if (serializedState === null) {
                console.log('No save data found, starting fresh.');
                return null;
            }
            return JSON.parse(serializedState);
        } catch (error) {
            console.error('Failed to load game data:', error);
            return null;
        }
    }
    
    clearSave() {
        localStorage.removeItem(this.saveKey);
        console.log('Save data cleared.');
    }
}
