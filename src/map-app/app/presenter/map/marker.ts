import { Point2d } from '../../../common-types';
import { EventBus } from '../../../eventbus';
import { toPoint2d, toString as _toString } from '../../../utils';
import { InitiativeRenderFunction } from '../../model/config-schema';
import { Initiative } from '../../model/initiative';
import { BasePresenter } from '../base';
import { MapMarkerView } from '../../view/map/marker';
import { MapUI } from '../../map-ui';

export class MapMarkerPresenter extends BasePresenter {
  readonly view: MapMarkerView;
  
  constructor(readonly mapUI: MapUI,
              readonly initiative: Initiative,
              readonly popup: InitiativeRenderFunction,
              public hasPhysicalLocation: boolean = false) {
    super();
    this.view = new MapMarkerView(this);
  }

  notifySelectionToggled(initiative: Initiative): void {
    EventBus.Marker.selectionToggled.pub(initiative);
  }

  getLatLng(initiative: Initiative): Point2d|undefined {
    return toPoint2d([initiative.lat, initiative.lng], null) ?? undefined;
  }

  getHoverText(initiative: Initiative): string {
    return _toString(initiative.name);
  }

  getInitiativeContent(initiative: Initiative): string {
    return this.popup(initiative, this.mapUI.dataServices);
  }
}
