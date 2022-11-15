import type {
  DataConsumer
} from '../src/map-app/app/model/dataloader';
import {
  InitiativeObj,
} from '../src/map-app/app/model/dataservices';
import {
  assert
} from 'chai';

export class TestConsumer implements DataConsumer<InitiativeObj> {
  constructor(readonly ids: string[], readonly data: InitiativeObj[] = []) { }
  isComplete: boolean = false;
  errors: Error[] = [];
  addBatch(id: string, initiatives: InitiativeObj[]) {
    assert(this.ids.includes(id));
    this.data.push(...initiatives);
  };
  complete(id: string) {
    assert(this.ids.includes(id));
    this.isComplete = true;
  };
  fail(id: string, error: Error) {
    assert(this.ids.includes(id));
    this.errors.push(error);
  };
};
