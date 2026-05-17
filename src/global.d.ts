declare global {
  interface Window {
    location: Location;
    history: History;
    dispatchEvent: (event: Event) => boolean;
  }
  interface PopStateEvent extends Event {
    state: any;
  }
  function PopStateEvent(type: string, init?: { state?: any }): PopStateEvent;
}

export {};