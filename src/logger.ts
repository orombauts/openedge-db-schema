const PREFIX = '[OpenEdge DB Schema]';

export function log(...args: any[]) {
    console.log(PREFIX, ...args);
}

export function logError(...args: any[]) {
    console.error(PREFIX, ...args);
}
