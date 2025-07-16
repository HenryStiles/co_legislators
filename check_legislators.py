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

def validate_legislators_data():
    """
    Validates the legislators.json file for data integrity and completeness.
    
    This function performs comprehensive validation checks on the legislator data:
    - Ensures all required fields are present and non-blank
    - Validates data types and formats
    - Checks for ASCII compliance in text fields
    - Verifies URL format for links
    - Ensures proper structure for committees and counties
    
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

    # Validate each legislator record
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
        
        # Add this legislator's errors to the main error list
        if leg_errors:
            errors.append((i, leg.get('Name', 'Unknown'), leg_errors))

    return errors

def main():
    """
    Main function to run the validation and display results.
    """
    print("Validating legislators.json...")
    
    errors = validate_legislators_data()
    
    if errors:
        print(f'\nValidation errors found ({len(errors)} legislators with issues):')
        print('=' * 60)
        for idx, name, errs in errors:
            print(f'Legislator #{idx+1} ({name}):')
            for err in errs:
                print(f'  - {err}')
            print()
    else:
        print('✅ All legislators passed validation.')
        print(f'Total legislators validated: {len(json.load(open("legislators.json")))}')

if __name__ == "__main__":
    main() 