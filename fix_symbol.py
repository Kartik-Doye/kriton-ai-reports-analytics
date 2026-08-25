import re

with open('src/components/FireSymbol.tsx', 'r') as f:
    content = f.read()

content = content.replace("position: relative;\n  width: 100px;\n  height: 100px;\n  transform: scale(0.4);\n  transform-origin: center;", 
                          "position: relative;\n  width: 40px;\n  height: 40px;\n  transform: scale(0.4);\n  transform-origin: top left;")

with open('src/components/FireSymbol.tsx', 'w') as f:
    f.write(content)

