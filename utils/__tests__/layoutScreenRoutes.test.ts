// @ai-generated
/**
 * Every <Stack.Screen name="…"> in an app/ layout must name a route file or
 * folder next to that layout. A name with no route is silently ignored by
 * expo-router (its options never apply), and a route with no entry falls back
 * to the stack's screenOptions, which on the Home stack drew a native header
 * over BrowseSurahs' own one on non-glass devices.
 */
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(__dirname, '..', '..', 'app');

function layoutFiles(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return layoutFiles(full);
    return entry.name === '_layout.tsx' ? [full] : [];
  });
}

function screenNames(source: string): string[] {
  return [...source.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map(
    match => match[1],
  );
}

function routeExists(dir: string, name: string): boolean {
  const base = path.join(dir, name);
  return (
    fs.existsSync(`${base}.tsx`) ||
    fs.existsSync(`${base}.ts`) ||
    (fs.existsSync(base) && fs.statSync(base).isDirectory())
  );
}

describe('layout Stack.Screen entries', () => {
  const layouts = layoutFiles(APP_DIR);

  it('finds the app layouts', () => {
    expect(layouts.length).toBeGreaterThan(3);
  });

  it.each(layouts.map(file => [path.relative(APP_DIR, file), file]))(
    '%s names only routes that exist',
    (_label, file) => {
      const dir = path.dirname(file);
      const missing = screenNames(fs.readFileSync(file, 'utf8')).filter(
        name => !routeExists(dir, name),
      );
      expect(missing).toEqual([]);
    },
  );

  it('declares browse-all-surahs on the Home stack', () => {
    const home = fs.readFileSync(
      path.join(APP_DIR, '(tabs)', '(a.home)', '_layout.tsx'),
      'utf8',
    );
    expect(screenNames(home)).toContain('browse-all-surahs');
  });
});
