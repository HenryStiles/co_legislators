"""
Colorado Legislator Data Validator

This script validates the integrity and completeness of the legislators.json file.
It performs various checks to ensure data quality and consistency.

Author: Your Name
Version: 1.0
Dependencies: json, re
"""

import json
import sys
import re
import os

def validate_legislators_data():
    """
    Validates the legislators.json file for data integrity and completeness.
    
    This function performs comprehensive validation checks on the legislator data:
    - Ensures all required fields are present and non-blank
    - Validates data types and formats
    - Checks for ASCII compliance in text fields
    - Verifies URL format for links
    - Ensures proper structure for committees and counties
    - Verifies that profile pictures exist on disk
    
    Returns:
        list: List of tuples containing (index, name, errors) for each legislator with issues
        
    Raises:
        FileNotFoundError: If legislators.json doesn't exist
        json.JSONDecodeError: If the JSON file is malformed
    """
    
    # Load legislators.json
    try:
        with open('legislators.json', 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error: legislators.json not found. Run legs.py first to generate the data.")
        return []
    except json.JSONDecodeError as e:
        print(f"Error: legislators.json is not valid JSON: {e}")
        return []

    # Compile regex patterns for validation
    ascii_re = re.compile(r'^[\x00-\x7F]+$')  # ASCII-only characters
    url_re = re.compile(r'^https?://')        # Valid URL format

    errors = []
    seen_seats = set()
    senate_districts = set()
    house_districts = set()

    # Validate each legislator record
    for i, leg in enumerate(data):
        leg_errors = []
        
        # District: must be numeric and not blank
        dist = str(leg.get('District', '')).strip()
        if not dist or not dist.isdigit():
            leg_errors.append('District is blank or not numeric')
        
        # Chamber: must be Senate or House
        chamber = leg.get('Chamber', '')
        if chamber not in ('Senate', 'House'):
            leg_errors.append(f"Chamber is invalid: {chamber}")

        # Check for duplicate seat assignments
        if dist and dist.isdigit() and chamber in ('Senate', 'House'):
            seat_key = (chamber, dist)
            if seat_key in seen_seats:
                leg_errors.append(f'Duplicate seat assignment for {chamber} District {dist}')
            seen_seats.add(seat_key)
            if chamber == 'Senate':
                senate_districts.add(int(dist))
            elif chamber == 'House':
                house_districts.add(int(dist))
        
        # Name: must be non-blank and ASCII
        name = leg.get('Name', '')
        if not name:
            leg_errors.append('Name is blank')
        elif not ascii_re.match(name):
            leg_errors.append(f'Name is not ASCII: {name}')
        
        # Party: must be non-blank
        if not leg.get('Party'):
            leg_errors.append('Party is blank')
        
        # Link: must be non-blank and look like a URL
        link = leg.get('Link', '')
        if not link or not url_re.match(link):
            leg_errors.append('Link is blank or not a valid URL')

        # Picture: must be non-blank and point to an existing file
        picture = leg.get('Picture', '')
        if not picture or picture == "N/A":
            leg_errors.append('Picture is missing or N/A')
        elif not os.path.exists(picture):
            leg_errors.append(f'Picture file does not exist: {picture}')
        
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

        # Note: optional, but if present must be ASCII
        note = leg.get('Note', '')
        if note and not ascii_re.match(note):
            leg_errors.append(f'Note is not ASCII: {note}')
        
        # Add this legislator's errors to the main error list
        if leg_errors:
            errors.append((i, leg.get('Name', 'Unknown'), leg_errors))

    # Validate overall chamber district coverage (35 Senate, 65 House)
    expected_senate = set(range(1, 36))
    expected_house = set(range(1, 66))
    coverage_errors = []

    missing_senate = sorted(expected_senate - senate_districts)
    if missing_senate:
        coverage_errors.append(f"Missing Senate districts: {missing_senate}")

    missing_house = sorted(expected_house - house_districts)
    if missing_house:
        coverage_errors.append(f"Missing House districts: {missing_house}")

    if len(data) != 100:
        coverage_errors.append(f"Expected 100 total seats (35 Senate + 65 House), found {len(data)}")

    if coverage_errors:
        errors.append((-1, "Chamber Completeness", coverage_errors))

    return errors

def main():
    """
    Main function to run the validation and display results.
    """
    print("Validating legislators.json...")
    
    errors = validate_legislators_data()
    
    if errors:
        print(f'\nValidation errors found ({len(errors)} issues):')
        print('=' * 60)
        for idx, name, errs in errors:
            header = f'Legislator #{idx+1} ({name}):' if idx >= 0 else f'{name}:'
            print(header)
            for err in errs:
                print(f'  - {err}')
            print()
    else:
        print('✅ All legislators passed validation.')
        print(f'Total legislators validated: {len(json.load(open("legislators.json")))} (35 Senate, 65 House)')

if __name__ == "__main__":
    main() 