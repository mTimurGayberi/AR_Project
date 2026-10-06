import { ZComponent, ContextManager, Observable, Animation, Layer, LayerClip, Event, ConstructorForComponent } from "@zcomponent/core";

import { Box as Box_0 } from "@zcomponent/three/lib/components/meshes/Box";
import { DefaultCookieConsent as DefaultCookieConsent_1 } from "@zcomponent/core/lib/components/DefaultCookieConsent";
import { DefaultEnvironment as DefaultEnvironment_2 } from "@zcomponent/three/lib/components/environments/DefaultEnvironment";
import { DefaultLoader as DefaultLoader_3 } from "@zcomponent/core/lib/components/DefaultLoader";
import { Group as Group_4 } from "@zcomponent/three/lib/components/Group";
import { DirectionalLight as DirectionalLight_5 } from "@zcomponent/three/lib/components/lights/DirectionalLight";
import { PerspectiveCamera as PerspectiveCamera_6 } from "@zcomponent/three/lib/components/cameras/PerspectiveCamera";
import { ShadowPlane as ShadowPlane_7 } from "@zcomponent/three/lib/components/meshes/ShadowPlane";

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
		Box: Box_0 & {
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
		Defaults: Group_4 & {
			behaviors: {

			}
		},
		DirectionalLight: DirectionalLight_5 & {
			behaviors: {

			}
		},
		PerspectiveCamera: PerspectiveCamera_6 & {
			behaviors: {

			}
		},
		ShadowPlane: ShadowPlane_7 & {
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
