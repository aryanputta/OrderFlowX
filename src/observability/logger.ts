export const createLogger = (service: string) => {
  return (message: string, context: Record<string, unknown> = {}) => {
    console.log(
      JSON.stringify({
        service,
        message,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
  };
};
