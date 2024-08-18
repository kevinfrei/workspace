export const verPattern = /^(major|minor|patch|\d+(\.\d+(\.\d+)?)?)$/;
export function BumpVersion(version: string, bump: string): string {
  const parts = version.split('.');
  if (bump == 'major') {
    return `${parseInt(parts[0]) + 1}.0.0`;
  }
  if (bump == 'minor') {
    return `${parts[0]}.${parseInt(parts[1]) + 1}.0`;
  }
  if (bump == 'patch') {
    return `${parts[0]}.${parts[1]}.${parseInt(parts[2]) + 1}`;
  }
  const split = bump.split('.');
  if (split.length == 1) {
    return `${bump}.0.0`;
  }
  if (split.length == 2) {
    return `${bump}.0`;
  }
  return bump;
}
