import re

with open('github-action/index.js', 'r') as f:
    content = f.read()

# I will just write the entire content manually since it's cleaner than regex replacing conflict markers.
