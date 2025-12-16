"""
Test code quality and conventions.
"""
import os
import re

def check_file_for_patterns(filename, patterns):
    """Check a file for specific patterns."""
    issues = []
    with open(filename, 'r') as f:
        lines = f.readlines()
        for i, line in enumerate(lines, 1):
            for pattern_name, pattern, message in patterns:
                if pattern.search(line):
                    issues.append((i, pattern_name, message, line.strip()))
    return issues

def test_code_patterns():
    """Test for common code patterns and issues."""
    python_files = [
        'ApiHandler.py',
        'config.py', 
        'database.py',
        'models.py',
        'load_data_db.py',
        'visualize.py',
    ]
    
    # Define patterns to check for
    patterns = [
        ('print_statement', re.compile(r'^\s*print\('), 
         'Consider using logging instead of print statements'),
        ('debug_comment', re.compile(r'#.*TODO|FIXME|XXX|HACK'),
         'Found TODO/FIXME/XXX/HACK comment'),
        ('long_line', re.compile(r'^.{100,}'),
         'Line exceeds 100 characters'),
    ]
    
    all_issues = []
    for file in python_files:
        if os.path.exists(file):
            issues = check_file_for_patterns(file, patterns)
            if issues:
                print(f"\nIssues in {file}:")
                for line_num, pattern_name, message, line in issues:
                    print(f"  Line {line_num}: [{pattern_name}] {message}")
                    print(f"    {line[:60]}..." if len(line) > 60 else f"    {line}")
                all_issues.extend([(file, i[0], i[2]) for i in issues])
    
    if not all_issues:
        print("Code patterns test passed (no issues found)")
    else:
        print(f"\nFound {len(all_issues)} code quality issues (warnings only)")

def test_import_order():
    """Check import order convention."""
    # This is a simple check - more sophisticated check would parse AST
    print("Import order test skipped (basic test suite)")

def test_docstrings():
    """Check for docstrings in key functions."""
    key_files = ['ApiHandler.py', 'models.py', 'database.py']
    
    for file in key_files:
        if os.path.exists(file):
            with open(file, 'r') as f:
                content = f.read()
                # Simple check for function definitions with docstrings
                func_defs = re.findall(r'def\s+(\w+)', content)
                # Check a few key functions
                for func in ['get_map', 'get_nodes', 'serialize_node'][:2]:
                    if func in func_defs:
                        # Look for docstring after function definition
                        pattern = r'def\s+' + func + r'.*?:\s*\n\s*""".*?"""'
                        if re.search(pattern, content, re.DOTALL):
                            print(f"{func}() in {file} has docstring")
                        else:
                            print(f"{func}() in {file} might be missing docstring")
    
    print("Docstring test completed")

if __name__ == "__main__":
    test_code_patterns()
    test_import_order()
    test_docstrings()