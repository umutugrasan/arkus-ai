import os
import glob
import re

router_dir = r"c:\Users\yunusozdemir\Desktop\hackhathlon\basiret-ai\backend\app\routers"
files = glob.glob(os.path.join(router_dir, "*.py"))

for file_path in files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Skip auth.py and __init__.py
    if "auth.py" in file_path or "__init__.py" in file_path:
        continue

    # Add imports
    if "Depends" not in content:
        content = content.replace("from fastapi import APIRouter", "from fastapi import APIRouter, Depends")
    
    if "get_current_user" not in content:
        content = content.replace("from app.services.marketplace_api", "from app.dependencies import get_current_user\nfrom app.services.marketplace_api")

    # Add user = Depends(get_current_user) to all route definitions
    # Match def function_name(...):
    # Regex to find: def my_func(arg1: type = val):
    
    def replacer(match):
        func_def = match.group(0)
        # Avoid double adding
        if "user = Depends(get_current_user)" in func_def:
            return func_def
            
        if func_def.endswith("):"):
            if func_def.endswith("()"):
                return func_def.replace("():", "(user = Depends(get_current_user)):")
            else:
                return func_def.replace("):", ", user = Depends(get_current_user)):")
        return func_def

    # Only apply to functions decorated with @router
    lines = content.split('\n')
    new_lines = []
    in_route = False
    for line in lines:
        if line.startswith("@router."):
            in_route = True
            new_lines.append(line)
        elif in_route and line.startswith("def "):
            if "(msg: ChatMessage" in line:
                line = line.replace("(msg: ChatMessage", "(msg: ChatMessage, user = Depends(get_current_user)")
            elif "()" in line:
                line = line.replace("():", "(user = Depends(get_current_user)):")
            else:
                line = line.replace("):", ", user = Depends(get_current_user)):")
            in_route = False
            new_lines.append(line)
        else:
            in_route = False
            new_lines.append(line)
            
    content = "\n".join(new_lines)

    # Replace fetch function calls
    content = content.replace("fetch_all_marketplaces()", "fetch_all_marketplaces(user.id)")
    content = content.replace("fetch_store_info(mp)", "fetch_store_info(mp, user.id)")
    content = content.replace("fetch_reviews(marketplace=\"all\")", "fetch_reviews(marketplace=\"all\", user_id=user.id)")
    content = content.replace("fetch_reviews(marketplace=marketplace)", "fetch_reviews(marketplace=marketplace, user_id=user.id)")
    content = content.replace("fetch_reviews(marketplace=mp)", "fetch_reviews(marketplace=mp, user_id=user.id)")
    content = content.replace("fetch_reviews(marketplace=mp, product_id=product_id)", "fetch_reviews(marketplace=mp, user_id=user.id, product_id=product_id)")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Refactoring completed.")
