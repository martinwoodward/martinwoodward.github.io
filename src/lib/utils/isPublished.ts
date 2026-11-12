// Future-dated content stays out of the build until its date has passed.
export const isPublished = (data: { date?: Date }) =>
  !data.date || data.date.getTime() <= Date.now();
