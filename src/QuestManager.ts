export interface Quest {
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    requiredProgress: number;
    currentProgress: number;
}

export class QuestManager {
    private quests: Map<string, Quest> = new Map();

    // Define initial quests here or load from an external JSON
    constructor() {
        this.addQuest({
            id: 'q_intro',
            title: 'Sensei\'s First Task',
            description: 'Find the hidden scroll in the AR scene.',
            isCompleted: false,
            requiredProgress: 1,
            currentProgress: 0
        });
        
        // Add more quests as your 10 scenes develop
    }

    addQuest(quest: Quest) {
        this.quests.set(quest.id, quest);
    }

    getQuest(id: string): Quest | undefined {
        return this.quests.get(id);
    }

    getAllQuests(): Quest[] {
        return Array.from(this.quests.values());
    }

    updateProgress(id: string, amount: number) {
        const quest = this.quests.get(id);
        if (quest && !quest.isCompleted) {
            quest.currentProgress += amount;
            if (quest.currentProgress >= quest.requiredProgress) {
                quest.currentProgress = quest.requiredProgress;
                this.completeQuest(id);
            }
        }
    }

    completeQuest(id: string) {
        const quest = this.quests.get(id);
        if (quest && !quest.isCompleted) {
            quest.isCompleted = true;
            console.log(`Quest Completed: ${quest.title}`);
            // Fire an event here if you use an event system to update UI
        }
    }

    // Used for save/load
    exportState(): any {
        const state: any = {};
        this.quests.forEach((quest, id) => {
            state[id] = {
                currentProgress: quest.currentProgress,
                isCompleted: quest.isCompleted
            };
        });
        return state;
    }

    importState(state: any) {
        if (!state) return;
        for (const id in state) {
            const quest = this.quests.get(id);
            if (quest) {
                quest.currentProgress = state[id].currentProgress;
                quest.isCompleted = state[id].isCompleted;
            }
        }
    }
}
