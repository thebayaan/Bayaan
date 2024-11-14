declare global {
  namespace NodeJS {
    interface Global {
      playbackServiceRegistered: boolean;
    }
  }
}

export {};
