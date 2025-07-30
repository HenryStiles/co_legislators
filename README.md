# Colorado Legislative District Maps

This is an interactive web application that visualizes the legislative districts of the Colorado General Assembly (Senate and House) using Leaflet.js. It provides a clear, color-coded view of districts based on political party affiliation and offers detailed information about each legislator.

## Features

-   **Dual Interactive Maps**: Separate, fully interactive maps for both the Colorado Senate and House of Representatives.
-   **Color-Coded Districts**: Districts are color-coded by political party (Democrat, Republican, or other) for easy visual identification.
-   **Detailed Legislator Popups**: Clicking on a district reveals a popup with detailed information about the legislator, including:
    -   Full name and party
    -   Counties served
    -   Committee assignments
-   **Toggleable Map Layers**: A layer control allows users to toggle the visibility of additional geographical boundaries, including:
    -   County lines
    -   Zip code boundaries
-   **Interactive Overlays**: Click on a county or zip code area to see its name or number in a popup.

## Data Sources
This project was developed with the assistance of an AI coding assistant, Gemini Code Assist. The AI was utilized for various tasks including code generation, refactoring, debugging, and documentation writing to improve code quality and accelerate development.

## Data Sources and Citations

The application relies on several data sources to visualize the legislative landscape of Colorado:

-   **Legislator Information (`legislators.json`):** Data was compiled from the official Colorado General Assembly website. This file contains legislator names, party affiliations, districts, and committee assignments.

-   **District Boundaries (`senate_coords.json`, `house_coords.json`):** Geographic boundary data for Senate and House districts is based on the 2021 approved redistricting plans from the Colorado Independent Redistricting Commissions.

-   **County and Zip Code Boundaries (`colorado_counties.geojson`, `co_colorado_zip_codes_geo.min.json`):** These GeoJSON files are derived from the U.S. Census Bureau's TIGER/Line Shapefiles, which provide public geospatial data for various administrative and statistical boundaries.

## Setup and Usage

This project was developed with the assistance of an AI coding assistant, Gemini Code Assist. The AI was utilized for various tasks including code generation, refactoring, debugging, and documentation writing to improve code quality and accelerate development.

This is a static web application and does not require a complex setup.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd co_legislators
    ```

2.  **Serve the files:**
    You need a simple local web server to run the `index.html` file. A common way to do this is with Python's built-in HTTP server.

    If you have Python 3:
    ```bash
    python -m http.server
    ```

    If you have Python 2:
    ```bash
    python -m SimpleHTTPServer
    ```

    Alternatively, you can use the Live Server extension for Visual Studio Code.

3.  **Open in your browser:**
    Navigate to `http://localhost:8000` (or the port specified by your server) in your web browser to view the maps.