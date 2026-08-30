import re

with open("src/services/storageService.ts", "r") as f:
    content = f.read()

content = content.replace("function saveJson<T>(key: string, val: T): void {", "export function saveJson<T>(key: string, val: T): void {")
content = content.replace("function loadJson<T>(key: string, def: T): T {", "export function loadJson<T>(key: string, def: T): T {")

with open("src/services/storageService.ts", "w") as f:
    f.write(content)
