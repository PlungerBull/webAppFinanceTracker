import os
import re
import sys
import datetime
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(os.getcwd())
FEATURES_DIR = PROJECT_ROOT / "features"
DOCS_DIR = PROJECT_ROOT / "docs/documentation"

def to_camel_case(s):
    return s[0].lower() + s.replace("_", "").replace("-", "")[1:]

class FeatureAuditor:
    def __init__(self, feature_name):
        self.feature_name = feature_name
        self.feature_path = FEATURES_DIR / feature_name
        self.files = []
        self.inventory = {}
        self.issues = []
        self.stats = {
            "entity_registry": "PASS",
            "dependency_manifest": "PASS",
            "sacred_mandate": "PASS",
            "performance": "PASS",
            "naming": "PASS",
            "feature_bleed": [],
        }
        self.mandate_checks = {
            "integer_cents": "N/A",
            "sync_integrity": "N/A",
            "soft_deletes": "N/A",
            "auth_abstraction": "N/A",
        }
        self.performance_checks = {
            "react_compiler": "PASS",
            "re_render": "PASS",
        }

    def scan_files(self):
        for root, _, files in os.walk(self.feature_path):
            for file in files:
                if file.endswith((".ts", ".tsx")):
                    path = Path(root) / file
                    rel_path = path.relative_to(PROJECT_ROOT)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        lines = content.splitlines()
                    
                    self.files.append({
                        "path": path,
                        "rel_path": str(rel_path),
                        "name": file,
                        "content": content,
                        "lines": len(lines),
                        "line_content": lines
                    })

    def audit_variable_entity_registry(self):
        # Scan for interfaces, types, classes
        entities = []
        naming_violations = []
        
        for file in self.files:
            content = file["content"]
            # Regex for interface/type/class definitions
            # strict camelCase check for properties in interfaces/types would be complex, 
            # let's look for explicit snake_case in domain files.
            
            is_domain = "domain" in file["rel_path"]
            
            if is_domain:
                # Check for snake_case properties in interfaces
                # Look for `  some_property: `
                snake_props = re.findall(r'^\s*([a-z]+_[a-z0-9_]*)\??\s*:', content, re.MULTILINE)
                for prop in snake_props:
                    naming_violations.append(f"Snake_case property '{prop}' in domain file {file['rel_path']}")

            # Collect entities for inventory
            # interface Name {
            matches = re.findall(r'(export )?(interface|type|class) ([A-Za-z0-9]+)', content)
            for _, kind, name in matches:
                entities.append({
                    "name": name,
                    "kind": kind,
                    "file": file["rel_path"]
                })

        if naming_violations:
            self.stats["naming"] = "FAIL"
            self.issues.extend(naming_violations)
        
        return entities

    def audit_dependencies(self):
        feature_bleed = []
        transformers = []
        
        for file in self.files:
            lines = file["line_content"]
            for i, line in enumerate(lines):
                if line.strip().startswith("import "):
                    # Extract path
                    match = re.search(r'from [\'"]([^\'"]+)[\'"]', line)
                    if match:
                        path_str = match.group(1)
                        
                        # Feature bleed check
                        if path_str.startswith("@/features/") or path_str.startswith("../../features/"):
                            target_feature = path_str.split("features/")[1].split("/")[0]
                            if target_feature != self.feature_name and target_feature != "shared":
                                feature_bleed.append(f"Import from {target_feature} in {file['rel_path']}:{i+1}")
                        
                        # Transformer check
                        if "types/data-transformers" in path_str or "data/data-transformers" in path_str:
                             transformers.append(f"Uses data-transformers in {file['rel_path']}:{i+1}")

        if feature_bleed:
            self.stats["dependency_manifest"] = "FAIL"
            self.stats["feature_bleed"] = feature_bleed
            self.issues.extend(feature_bleed)
        
        return transformers

    def audit_sacred_mandate(self):
        # Integer Cents
        has_financial = False
        float_violations = []
        for file in self.files:
            content = file["content"]
            if "balance" in content.lower() or "amount" in content.lower() or "price" in content.lower():
                has_financial = True
                # Look for potential float usage (rough check)
                if "number" in content and ("float" in content.lower() or "double" in content.lower()): 
                    float_violations.append(f"Potential float usage in {file['rel_path']}")
                
        if has_financial:
            self.mandate_checks["integer_cents"] = "PASS" if not float_violations else "FAIL"
            if float_violations: self.issues.extend(float_violations)
        
        # Soft Deletes
        has_delete = False
        delete_violations = []
        for file in self.files:
            # Check for delete methods
            if "delete" in file["content"].lower():
                 # Check if deleted_at is mentioned
                 if "deleted_at" not in file["content"] and "deletedAt" not in file["content"]:
                     # If it's a repository, it might be a hard delete
                     if "repository" in file["rel_path"]:
                         delete_violations.append(f"Potential hard delete verification needed in {file['rel_path']}")
                         has_delete = True
        
        if has_delete:
            self.mandate_checks["soft_deletes"] = "PASS" if not delete_violations else "WARNING"
            if delete_violations: self.issues.extend(delete_violations)

        # Auth Abstraction
        auth_violations = []
        for file in self.files:
            if "supabase.auth." in file["content"]:
                # Allowed only in providers/implementations, not in feature logic using it directly check context?
                # Actually, check if it imports supabase client and calls auth.
                # If its in `features/` and not `features/auth`, it's likely a violation unless encapsulated
                if self.feature_name != "auth":
                    auth_violations.append(f"Direct supabase.auth usage in {file['rel_path']}")
        
        if auth_violations:
            self.mandate_checks["auth_abstraction"] = "FAIL"
            self.issues.extend(auth_violations)
        else:
            self.mandate_checks["auth_abstraction"] = "PASS"

    def audit_performance(self):
        # React Compiler / Re-render
        watch_violations = []
        for file in self.files:
            if "watch(" in file["content"] and "useWatch" not in file["content"]:
                # Check if it's react-hook-form's watch
                if "react-hook-form" in file["content"]:
                     watch_violations.append(f"Usage of watch() instead of useWatch in {file['rel_path']}")
        
        if watch_violations:
            self.performance_checks["react_compiler"] = "FAIL"
            self.issues.extend(watch_violations)

    def generate_markdown(self):
        entities = self.audit_variable_entity_registry()
        transformers = self.audit_dependencies()
        self.audit_sacred_mandate()
        self.audit_performance()
        
        out = []
        out.append(f"# Composable Manifest: features/{self.feature_name}")
        out.append("")
        out.append(f"> **Generated**: {datetime.date.today().isoformat()}")
        out.append("> **Auditor**: Automated Construction Agent")
        out.append(f"> **Scope**: `/features/{self.feature_name}/` folder")
        out.append("")
        out.append("---")
        out.append("")
        out.append("## Executive Summary")
        out.append("")
        out.append("| Category | Status | Notes |")
        out.append("|----------|--------|-------|")
        out.append(f"| Variable & Entity Registry | {self.stats['naming']} | {'Issues found' if self.stats['naming'] == 'FAIL' else 'Clean'} |")
        out.append(f"| Dependency Manifest | {self.stats['dependency_manifest']} | {len(self.stats['feature_bleed'])} violations |")
        out.append(f"| Sacred Mandate | {self.stats['sacred_mandate']} | Auth: {self.mandate_checks['auth_abstraction']} |")
        out.append(f"| Performance | {self.stats['performance']} | Watch Usage: {self.performance_checks['react_compiler']} |")
        out.append("")
        if self.issues:
            out.append("**Issues Found:**")
            for issue in self.issues:
                out.append(f"- {issue}")
        else:
            out.append("**Overall Result: PASSED**")
        out.append("")
        out.append("---")
        out.append("")
        
        # 1. Variable & Entity Registry
        out.append("## 1. Variable & Entity Registry")
        out.append("")
        out.append(f"### 1.1 Feature File Inventory")
        out.append(f"**Total Files**: {len(self.files)}")
        out.append("")
        
        # Group by folder
        files_by_folder = {}
        for f in self.files:
            folder = os.path.dirname(f["rel_path"])
            if folder not in files_by_folder: files_by_folder[folder] = []
            files_by_folder[folder].append(f)
            
        for folder, fs in files_by_folder.items():
            out.append(f"#### {folder}")
            out.append("| File | Lines |")
            out.append("|------|-------|")
            for f in fs:
                out.append(f"| `{f['name']}` | {f['lines']} |")
            out.append("")

        out.append("### 1.2 Entity Inventory")
        out.append("| Name | Kind | File |")
        out.append("|------|------|------|")
        for e in entities:
             out.append(f"| `{e['name']}` | {e['kind']} | `{e['file']}` |")
        out.append("")

        # 2. Dependency Manifest
        out.append("## 2. Dependency Manifest")
        out.append("")
        out.append(f"### 2.1 Feature Bleed Check")
        if self.stats["feature_bleed"]:
            out.append("**Result: FAIL**")
            out.append("")
            for violation in self.stats["feature_bleed"]:
                out.append(f"- {violation}")
        else:
            out.append("**Result: PASS**")
            out.append("No prohibited cross-feature imports detected.")
        out.append("")
        
        out.append(f"### 2.2 Transformer Usage")
        if transformers:
             out.append("| File | Usage |")
             out.append("|------|-------|")
             for t in transformers:
                 out.append(f"| {t} |")
        else:
             out.append("No explicit transformer imports found.")
             
        out.append("")
        out.append("## 3. Sacred Mandate Compliance")
        out.append("")
        
        for check, status in self.mandate_checks.items():
            display_name = check.replace('_', ' ').title()
            out.append(f"### 3.x {display_name}")
            out.append(f"**Status: {status}**")
            if status == "FAIL":
                 # List relevant issues
                 relevant = [i for i in self.issues if check in i.lower()] # Simplified matching
                 for r in relevant: out.append(f"- {r}")
            out.append("")

        out.append("## 4. Performance & Scalability")
        out.append("")
        out.append(f"### 4.1 React Compiler Check")
        out.append(f"**Status: {self.performance_checks['react_compiler']}**")
        if self.performance_checks['react_compiler'] == "FAIL":
             relevant = [i for i in self.issues if "watch" in i.lower()]
             for r in relevant: out.append(f"- {r}")

        return "\n".join(out)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python audit_feature.py <feature_name>")
        # Default to checking usage or running for all if implemented later
        sys.exit(1)
        
    feature_name = sys.argv[1]
    auditor = FeatureAuditor(feature_name)
    auditor.scan_files()
    report = auditor.generate_markdown()
    
    # Write to docs
    output_path = DOCS_DIR / f"audit-{feature_name}.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)
        
    print(f"Report written to {output_path}")
