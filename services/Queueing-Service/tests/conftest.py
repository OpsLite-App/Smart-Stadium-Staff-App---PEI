"""
Pytest configuration file
"""
import sys
import os

# Force Python to use the current directory's venv
venv_path = os.path.join(os.path.dirname(__file__), '..', 'venv')
if os.path.exists(venv_path):
    site_packages = os.path.join(venv_path, 'lib', f'python{sys.version_info.major}.{sys.version_info.minor}', 'site-packages')
    if os.path.exists(site_packages):
        sys.path.insert(0, site_packages)