import { ZComponent, ContextManager, Observable, Animation, Layer, LayerClip, Event, ConstructorForComponent } from "@zcomponent/core";

import { Group as Group_0 } from "@zcomponent/three/lib/components/Group";
import { DefaultCookieConsent as DefaultCookieConsent_1 } from "@zcomponent/core/lib/components/DefaultCookieConsent";
import { DefaultEnvironment as DefaultEnvironment_2 } from "@zcomponent/three/lib/components/environments/DefaultEnvironment";
import { DefaultLoader as DefaultLoader_3 } from "@zcomponent/core/lib/components/DefaultLoader";
import { DirectionalLight as DirectionalLight_4 } from "@zcomponent/three/lib/components/lights/DirectionalLight";
import { GroundAnchorGroup as GroundAnchorGroup_5 } from "@zcomponent/zappar-three/lib/components/anchorgroups/GroundAnchorGroup";
import { GLTF as GLTF_6 } from "@zcomponent/three/lib/components/models/GLTF";
import { ShadowPlane as ShadowPlane_7 } from "@zcomponent/three/lib/components/meshes/ShadowPlane";
import { UserPlacementAnchorGroup as UserPlacementAnchorGroup_8 } from "@zcomponent/zappar-three/lib/components/anchorgroups/UserPlacementAnchorGroup";
import { WorldTracker as WorldTracker_9 } from "@zcomponent/zappar-three/lib/components/trackers/WorldTracker";
import { ZapparCamera as ZapparCamera_10 } from "@zcomponent/zappar-three/lib/components/cameras/Camera";

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
		Game_2_Simon: Group_0 & {
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
		MazeWalls: GLTF_6 & {
			behaviors: {

			}
		},
		Props: Group_0 & {
			behaviors: {

			}
		},
		ShadowPlane: ShadowPlane_7 & {
			behaviors: {

			}
		},
		StartPad: GLTF_6 & {
			behaviors: {

			}
		},
		UserPlacementAnchorGroup: UserPlacementAnchorGroup_8 & {
			behaviors: {

			}
		},
		WorldTracker: WorldTracker_9 & {
			behaviors: {

			}
		},
		ZapparCamera: ZapparCamera_10 & {
			behaviors: {

			}
		},
		bamboo_glb: GLTF_6 & {
			behaviors: {

			}
		},
		flag: GLTF_6 & {
			behaviors: {

			}
		},
		flag_2_glb: GLTF_6 & {
			behaviors: {

			}
		},
		flag_glb: GLTF_6 & {
			behaviors: {

			}
		},
		gem: GLTF_6 & {
			behaviors: {

			}
		},
		mazeFloor_glb: GLTF_6 & {
			behaviors: {

			}
		},
		orb_glb: GLTF_6 & {
			behaviors: {

			}
		},
		rocks1_glb: GLTF_6 & {
			behaviors: {

			}
		},
		lantern_glb: GLTF_6 & {
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
