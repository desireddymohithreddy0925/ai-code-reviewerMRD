import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Parses multi-language dependency files (package.json, requirements.txt, Cargo.toml, etc.)
 * to inject strictly-versioned context into the LLM system prompt.
 */
export class DependencyParser {
  /**
   * Scans the workspace for known dependency files and aggregates them.
   * @param {string} workspacePath - Root directory of the repository
   * @returns {string} Aggregated dependency context string
   */
  static buildContext(workspacePath) {
    let context = '';
    const dependencies = {};

    // 1. Node.js (package.json)
    try {
      const pkgPath = join(workspacePath, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (Object.keys(deps).length > 0) {
          dependencies['Node.js'] = deps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse package.json: ${e.message}`);
    }

    // 2. Python (requirements.txt)
    try {
      const reqPath = join(workspacePath, 'requirements.txt');
      if (existsSync(reqPath)) {
        const reqContent = readFileSync(reqPath, 'utf8');
        const pythonDeps = {};
        const lines = reqContent.split('\n');
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9\-_]+)[=~><]+([0-9\.]+)/);
          if (match) {
            pythonDeps[match[1]] = match[2];
          }
        }
        if (Object.keys(pythonDeps).length > 0) {
          dependencies['Python (Pip)'] = pythonDeps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse requirements.txt: ${e.message}`);
    }

    // 3. Python (pyproject.toml)
    try {
      const tomlPath = join(workspacePath, 'pyproject.toml');
      if (existsSync(tomlPath)) {
        const tomlContent = readFileSync(tomlPath, 'utf8');
        const pythonDeps = {};
        // Heuristic extraction for [tool.poetry.dependencies] or [project.dependencies]
        const depsBlock = tomlContent.match(/\[(?:tool\.poetry|project)\.dependencies\]([\s\S]*?)(?:\[|$)/);
        if (depsBlock && depsBlock[1]) {
          const lines = depsBlock[1].split('\n');
          for (const line of lines) {
            const match = line.match(/^\s*([a-zA-Z0-9\-_]+)\s*=\s*["']?([><=~\^]*[0-9\.]+)["']?/);
            if (match) {
              pythonDeps[match[1]] = match[2];
            }
          }
        }
        if (Object.keys(pythonDeps).length > 0) {
          dependencies['Python (Poetry/PEP621)'] = pythonDeps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse pyproject.toml: ${e.message}`);
    }

    // 4. Rust (Cargo.toml)
    try {
      const cargoPath = join(workspacePath, 'Cargo.toml');
      if (existsSync(cargoPath)) {
        const cargoContent = readFileSync(cargoPath, 'utf8');
        const rustDeps = {};
        const depsBlock = cargoContent.match(/\[(?:build-|dev-)?dependencies\]([\s\S]*?)(?:\[|$)/g);
        if (depsBlock) {
          for (const block of depsBlock) {
            const lines = block.split('\n');
            for (const line of lines) {
               // Ignore header
               if (line.startsWith('[')) continue;
               const match = line.match(/^\s*([a-zA-Z0-9\-_]+)\s*=\s*(?:["']([^\n"']+)["']|\{.*?version\s*=\s*["']([^"']+)["'].*?\})/);
               if (match) {
                 rustDeps[match[1]] = match[2] || match[3];
               }
            }
          }
        }
        if (Object.keys(rustDeps).length > 0) {
          dependencies['Rust'] = rustDeps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse Cargo.toml: ${e.message}`);
    }

    // 5. Java (pom.xml)
    try {
      const pomPath = join(workspacePath, 'pom.xml');
      if (existsSync(pomPath)) {
        const pomContent = readFileSync(pomPath, 'utf8');
        const javaDeps = {};
        const depBlocks = pomContent.match(/<dependency>[\s\S]*?<\/dependency>/g);
        if (depBlocks) {
          for (const block of depBlocks) {
            const artifactMatch = block.match(/<artifactId>(.*?)<\/artifactId>/);
            const versionMatch = block.match(/<version>(.*?)<\/version>/);
            if (artifactMatch && versionMatch) {
              javaDeps[artifactMatch[1]] = versionMatch[1];
            }
          }
        }
        if (Object.keys(javaDeps).length > 0) {
          dependencies['Java (Maven)'] = javaDeps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse pom.xml: ${e.message}`);
    }

    // 6. Java (build.gradle)
    try {
      const gradlePath = join(workspacePath, 'build.gradle');
      if (existsSync(gradlePath)) {
        const gradleContent = readFileSync(gradlePath, 'utf8');
        const javaDeps = {};
        const lines = gradleContent.split('\n');
        for (const line of lines) {
          // match: implementation 'group:name:version'
          const match = line.match(/(?:implementation|compile|api|testImplementation)\s+['"]([^'"]+):([^'"]+):([^'"]+)['"]/);
          if (match) {
            javaDeps[match[2]] = match[3]; // name: version
          }
        }
        if (Object.keys(javaDeps).length > 0) {
          dependencies['Java (Gradle)'] = javaDeps;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse build.gradle: ${e.message}`);
    }

    if (Object.keys(dependencies).length > 0) {
      context = `\n\nCRITICAL CONTEXT: The project uses the following specific dependency versions:\n${JSON.stringify(dependencies, null, 2)}\nYou MUST ensure that your code suggestions are strictly aligned with these versions and their respective language ecosystems. Do not suggest deprecated methods for these specific versions.`;
    }

    return context;
  }
}
