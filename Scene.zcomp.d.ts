import { ZComponent, ContextManager, Observable, Animation, Layer, LayerClip, Event, ConstructorForComponent } from "@zcomponent/core";

import { Group as Group_0 } from "@zcomponent/three/lib/components/Group";
import { DefaultCookieConsent as DefaultCookieConsent_1 } from "@zcomponent/core/lib/components/DefaultCookieConsent";
import { DefaultEnvironment as DefaultEnvironment_2 } from "@zcomponent/three/lib/components/environments/DefaultEnvironment";
import { DefaultLoader as DefaultLoader_3 } from "@zcomponent/core/lib/components/DefaultLoader";
import { DirectionalLight as DirectionalLight_4 } from "@zcomponent/three/lib/components/lights/DirectionalLight";
import { GroundAnchorGroup as GroundAnchorGroup_5 } from "@zcomponent/zappar-three/lib/components/anchorgroups/GroundAnchorGroup";
import { ShadowPlane as ShadowPlane_6 } from "@zcomponent/three/lib/components/meshes/ShadowPlane";
import { WorldTracker as WorldTracker_7 } from "@zcomponent/zappar-three/lib/components/trackers/WorldTracker";
import { ZapparCamera as ZapparCamera_8 } from "@zcomponent/zappar-three/lib/components/cameras/Camera";
import { GLTF as GLTF_9 } from "@zcomponent/three/lib/components/models/GLTF";

interface ConstructorProps {

}

/**
* @zcomponent
* @zicon zcomponent
* @ztag zcomponent
*/
declare class Comp extends ZComponent {

	constructor(contextManager: ContextManager, constructorProps: ConstructorProps);

	nodes: {
		CollidersWalls: Group_0 & {
			behaviors: {

			}
		},
		DefaultCookieConsent: DefaultCookieConsent_1 & {
			behaviors: {

			}
		},
		DefaultEnvironment: DefaultEnvironment_2 & {
			behaviors: {

			}
		},
		DefaultLoader: DefaultLoader_3 & {
			behaviors: {

			}
		},
		Defaults: Group_0 & {
			behaviors: {

			}
		},
		DirectionalLight: DirectionalLight_4 & {
			behaviors: {

			}
		},
		Game_10_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_1_Maze: Group_0 & {
			behaviors: {

			}
		},
		Game_2_Placeholder: Group_0 & {
			behaviors: {

			}
		},
		Game_3_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_4_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_5_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_6_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_7_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_8_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Game_9_Placeholder_: Group_0 & {
			behaviors: {

			}
		},
		Ground_Anchor: GroundAnchorGroup_5 & {
			behaviors: {

			}
		},
		ShadowPlane: ShadowPlane_6 & {
			behaviors: {

			}
		},
		WorldTracker: WorldTracker_7 & {
			behaviors: {

			}
		},
		ZapparCamera: ZapparCamera_8 & {
			behaviors: {

			}
		},
		mazeFloor_glb: GLTF_9 & {
			behaviors: {

			}
		},
		mazeWalls_glb: GLTF_9 & {
			behaviors: {

			}
		},
		StartPad: GLTF_9 & {
			behaviors: {

			}
		},
		gem: GLTF_9 & {
			behaviors: {

			}
		},
		flag: GLTF_9 & {
			behaviors: {

			}
		},
	};

	animation: Animation & { layers: {

	}};

	/**
	 * The position, in 3D space, of this node relative to its parent. The three elements of the array correspond to the `x`, `y`, and `z` components of position.
	 * 
	 * @zprop
	 * @zdefault [0,0,0]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public position: Observable<[x: number, y: number, z: number]>;

	/**
	 * The rotation, in three dimensions, of this node relative to its parent. The three elements of the array correspond to Euler angles - yaw, pitch and roll.
	 * 
	 * @zprop
	 * @zdefault [0,0,0]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public rotation: Observable<[x: number, y: number, z: number]>;

	/**
	 * The scale, in three dimensions, of this node relative to its parent. The three elements of the array correspond to scales in the the `x`, `y`, and `z` axis.
	 * 
	 * @zprop
	 * @zdefault [1,1,1]
	 * @zgroup Transform
	 * @zgrouppriority 10
	 */
	public scale: Observable<[x: number, y: number, z: number]>;

	/**
	 * Determines if this object and its children are rendered to the screen.
	 * 
	 * @zprop
	 * @zdefault true
	 * @zgroup Appearance
	 * @zgrouppriority 11
	 */
	public visible: Observable<boolean>;
}

export default Comp;
