import json
import sys
import re

# Load legislators.json
with open('legislators.json', 'r') as f:
    data = json.load(f)

ascii_re = re.compile(r'^[\x00-\x7F]+$')
url_re = re.compile(r'^https?://')

errors = []

for i, leg in enumerate(data):
    leg_errors = []
    # District: must be numeric and not blank
    if not leg.get('District') or not str(leg['District']).isdigit():
        leg_errors.append('District is blank or not numeric')
    # Chamber: must be Senate or House
    if leg.get('Chamber') not in ('Senate', 'House'):
        leg_errors.append(f"Chamber is invalid: {leg.get('Chamber')}")
    # Name: must be non-blank and ASCII
    name = leg.get('Name', '')
    if not name:
        leg_errors.append('Name is blank')
    elif not ascii_re.match(name):
        leg_errors.append('Name is not ASCII')
    # Party: must be non-blank
    if not leg.get('Party'):
        leg_errors.append('Party is blank')
    # Link: must be non-blank and look like a URL
    link = leg.get('Link', '')
    if not link or not url_re.match(link):
        leg_errors.append('Link is blank or not a valid URL')
    # Committees: must be a list of dicts with non-blank name
    committees = leg.get('Committees', [])
    if not isinstance(committees, list):
        leg_errors.append('Committees is not a list')
    else:
        for c in committees:
            if not isinstance(c, dict) or not c.get('name'):
                leg_errors.append('Committee entry missing name or not a dict')
    # Counties: must be a non-empty list of ASCII strings
    counties = leg.get('Counties', [])
    if not isinstance(counties, list) or not counties:
        leg_errors.append('Counties is not a non-empty list')
    else:
        for county in counties:
            if not county or not ascii_re.match(county):
                leg_errors.append(f'County name not ASCII or blank: {county}')
    if leg_errors:
        errors.append((i, leg.get('Name', 'Unknown'), leg_errors))

if errors:
    print('Validation errors found:')
    for idx, name, errs in errors:
        print(f'Legislator #{idx+1} ({name}):')
        for err in errs:
            print(f'  - {err}')
else:
    print('All legislators passed validation.') 