import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = new URL('../features/', import.meta.url).pathname;
const files = readdirSync(root, { recursive: true }).filter(name => /[sS]trings\.ts$/.test(String(name)));
function object(node: ts.Expression): ts.ObjectLiteralExpression | undefined {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return ts.isObjectLiteralExpression(node) ? node : undefined;
}
function properties(node: ts.ObjectLiteralExpression) {
  return new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText().replace(/^['"]|['"]$/g, ''), p.initializer]));
}
function compare(zh: ts.ObjectLiteralExpression, en: ts.ObjectLiteralExpression, path: string) {
  const a = properties(zh), b = properties(en);
  expect([...a.keys()].sort(), path).toEqual([...b.keys()].sort());
  for (const [key, value] of a) {
    const left = object(value), right = b.get(key) && object(b.get(key)!);
    if (left && right) compare(left, right, path + '.' + key);
  }
}
describe('feature translations', () => {
  for (const file of files) it(String(file) + ' has matching zh and en keys', () => {
    const source = ts.createSourceFile(String(file), readFileSync(join(root, String(file)), 'utf8'), ts.ScriptTarget.Latest, true);
    let dictionaries = 0;
    function visit(node: ts.Node) {
      if (ts.isObjectLiteralExpression(node)) {
        const p = properties(node), zh = p.get('zh'), en = p.get('en');
        if (zh || en) {
          expect(zh, 'zh value').toBeDefined();
          expect(en, 'en value').toBeDefined();
          const left = object(zh!), right = object(en!);
          if (left || right) {
            expect(left, 'zh dictionary').toBeDefined();
            expect(right, 'en dictionary').toBeDefined();
            compare(left!, right!, String(file));
          }
          dictionaries++;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(dictionaries).toBeGreaterThan(0);
  });
});
