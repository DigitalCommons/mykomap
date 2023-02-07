
// 'Base class' for all presenters:
export class BasePresenter<V> {

  constructor(public view?: V) {}
  
  registerView(view: V) {
    this.view = view;
  }
}

