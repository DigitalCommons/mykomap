import { Dictionary, Point2d } from '../../../common_types';
import { EventBus } from '../../../eventbus';
import { toPoint2d, toString as _toString } from '../../../utils';
import { InitiativeRenderFunction } from '../../model/config_schema';
import { DataServices } from '../../model/dataservices';
import { Initiative } from '../../model/initiative';
import { BasePresenter } from '../../presenter';
import { MapMarkerView } from '../../view/map/marker';

export class MapMarkerPresenter extends BasePresenter {
  readonly labels: Dictionary;
  constructor(readonly view: MapMarkerView,
              readonly dataServices: DataServices,
              readonly popup: InitiativeRenderFunction) {
    super();
    this.labels = dataServices.getFunctionalLabels();
    this.popup = popup;
  }

  notifySelectionToggled(initiative: Initiative): void {
    EventBus.Marker.selectionToggled.pub(initiative);
  }

  notifySelectionSet(initiative: Initiative): void {
    EventBus.Marker.selectionSet.pub(initiative);
  }

  getLatLng(initiative: Initiative): Point2d|undefined {
    return toPoint2d([initiative.lat, initiative.lng]);
  }

  getHoverText(initiative: Initiative): string {
    return _toString(initiative.name);
  }

  getInitiativeContent(initiative: Initiative): string {
    return this.popup(initiative, this.dataServices);
  }
}
