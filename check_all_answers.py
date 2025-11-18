import csv
from difflib import SequenceMatcher
from datetime import datetime
from collections import defaultdict

def normalize_name(name):
    """Normalize a name by removing extra spaces, commas, and converting to lowercase"""
    return ' '.join(name.replace(',', ' ').lower().split())

def get_name_parts(name):
    """Extract first and last name from various formats"""
    normalized = normalize_name(name)
    parts = normalized.split()
    return parts

def names_match(name1, name2, threshold=0.8):
    """Check if two names match with fuzzy matching and handling reversed names"""
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)

    # Direct match
    if norm1 == norm2:
        return True

    # Get name parts
    parts1 = get_name_parts(name1)
    parts2 = get_name_parts(name2)

    # Need at least 2 parts (first and last name) in both
    if len(parts1) < 2 or len(parts2) < 2:
        return False

    # Check reversed names (First Last vs Last First)
    # Exact match reversed
    if (parts1[0] == parts2[-1] and parts1[-1] == parts2[0]):
        return True

    # Fuzzy match reversed - BOTH first and last must match well
    first_match_forward = SequenceMatcher(None, parts1[0], parts2[0]).ratio()
    last_match_forward = SequenceMatcher(None, parts1[-1], parts2[-1]).ratio()
    first_match_reversed = SequenceMatcher(None, parts1[0], parts2[-1]).ratio()
    last_match_reversed = SequenceMatcher(None, parts1[-1], parts2[0]).ratio()

    # Forward order: both first and last name must match
    if first_match_forward >= threshold and last_match_forward >= threshold:
        return True

    # Reversed order: both first and last name must match
    if first_match_reversed >= threshold and last_match_reversed >= threshold:
        return True

    return False

def find_student_index(rows, student_name, name_field):
    """Find the index of a student in the rows list"""
    for idx, row in enumerate(rows):
        name = row[name_field].strip()
        if names_match(name, student_name):
            return idx
    return -1

def detect_name_field(headers):
    """Detect which column contains student names"""
    # Look for columns with 'name' in them
    name_candidates = [h for h in headers if 'name' in h.lower()]

    # Prioritize fields with 'first' and 'last' in them
    for candidate in name_candidates:
        if 'first' in candidate.lower() or 'last' in candidate.lower():
            return candidate

    # Otherwise return the first name field found
    if name_candidates:
        return name_candidates[0]

    return None

def detect_timestamp_field(headers):
    """Detect which column contains timestamps"""
    timestamp_keywords = ['timestamp', 'date', 'time', 'submitted']

    for header in headers:
        if any(keyword in header.lower() for keyword in timestamp_keywords):
            return header

    return None

def parse_timestamp(timestamp_str):
    """Parse timestamp string into datetime object"""
    # Common timestamp formats
    formats = [
        '%m/%d/%Y %H:%M:%S',  # 7/24/2024 14:09:43
        '%Y-%m-%d %H:%M:%S',  # 2024-07-24 14:09:43
        '%m/%d/%Y',           # 7/24/2024
        '%Y-%m-%d',           # 2024-07-24
    ]

    for fmt in formats:
        try:
            return datetime.strptime(timestamp_str.strip(), fmt)
        except ValueError:
            continue

    return None

def cluster_by_date(rows, timestamp_field, gap_weeks=2):
    """Cluster submissions into programs based on date gaps"""
    # Parse all timestamps
    dates_with_idx = []
    for idx, row in enumerate(rows):
        timestamp_str = row.get(timestamp_field, '')
        if timestamp_str:
            dt = parse_timestamp(timestamp_str)
            if dt:
                dates_with_idx.append((dt, idx))

    if not dates_with_idx:
        return {}

    # Sort by date
    dates_with_idx.sort(key=lambda x: x[0])

    # Cluster based on gaps
    clusters = []
    current_cluster = [dates_with_idx[0]]
    gap_days = gap_weeks * 7

    for i in range(1, len(dates_with_idx)):
        prev_date = dates_with_idx[i-1][0]
        curr_date = dates_with_idx[i][0]

        # Calculate gap in days
        gap = (curr_date - prev_date).days

        if gap > gap_days:
            # Start new cluster
            clusters.append(current_cluster)
            current_cluster = [dates_with_idx[i]]
        else:
            # Add to current cluster
            current_cluster.append(dates_with_idx[i])

    # Add last cluster
    if current_cluster:
        clusters.append(current_cluster)

    # Map index to cluster number and get cluster info
    idx_to_cluster = {}
    cluster_info = {}

    for cluster_num, cluster in enumerate(clusters, 1):
        dates = [dt for dt, _ in cluster]
        start_date = min(dates)
        end_date = max(dates)

        # Generate program name based on month/year
        if start_date.month == end_date.month:
            program_name = f"{start_date.strftime('%B %Y')} Program"
        else:
            program_name = f"{start_date.strftime('%b')}-{end_date.strftime('%b %Y')} Program"

        cluster_info[cluster_num] = {
            'name': program_name,
            'start': start_date,
            'end': end_date,
            'count': len(cluster)
        }

        for _, idx in cluster:
            idx_to_cluster[idx] = cluster_num

    return idx_to_cluster, cluster_info

def load_group_definitions(filename='grouporder.txt'):
    """Load group definitions from grouporder.txt"""
    groups = {}
    current_group = None

    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                # Check if this is a group header
                if line.lower().startswith('group ') or line.lower().startswith('private '):
                    # Extract group name (e.g., "group 1", "PRIVATE 1")
                    current_group = line.rstrip(':').strip()
                    groups[current_group] = []
                elif current_group:
                    # This is a student name
                    groups[current_group].append(line)

        return groups
    except FileNotFoundError:
        print(f"\nWarning: {filename} not found. Grouping will be disabled.")
        return {}

def find_student_group(student_name, group_definitions):
    """Find which group a student belongs to using fuzzy matching"""
    for group_name, students in group_definitions.items():
        for group_student in students:
            if names_match(student_name, group_student):
                return group_name
    return "Ungrouped"

def detect_question_columns(headers):
    """Detect which columns contain questions (in order)"""
    # Skip common non-question columns
    skip_keywords = ['timestamp', 'score', 'group', 'private', 'name', 'email', 'date', 'time']

    question_cols = []
    for header in headers:
        # Skip if it contains any skip keywords
        if any(keyword in header.lower() for keyword in skip_keywords):
            continue
        # This is likely a question column
        question_cols.append(header)

    return question_cols

def find_answer_key(rows, name_field):
    """Find the answer key row by looking for 'testing' in the name"""
    answer_key_keywords = ['testing', 'answer', 'key']

    for idx, row in enumerate(rows):
        student_name = row[name_field].strip().lower()
        if any(keyword in student_name for keyword in answer_key_keywords):
            return idx, row[name_field].strip()

    return None, None

def main():
    print("=" * 60)
    print("EXAM ANSWER CHECKER WITH PROGRAM DETECTION")
    print("=" * 60)

    # Read the CSV file
    try:
        with open('answers.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        print("\nError: answers.csv not found in the current directory!")
        print("Please make sure answers.csv is in the same folder as this script.")
        return

    if not rows:
        print("\nError: answers.csv is empty!")
        return

    # Detect columns
    headers = list(rows[0].keys())

    # Find name field
    name_field = detect_name_field(headers)
    if not name_field:
        print("\nError: Could not find a name column in the CSV!")
        print("Available columns:", headers)
        return

    print(f"\nDetected name column: '{name_field}'")

    # Find timestamp field and cluster by programs
    timestamp_field = detect_timestamp_field(headers)
    idx_to_cluster = {}
    cluster_info = {}

    if timestamp_field:
        print(f"Detected timestamp column: '{timestamp_field}'")
        print("\nClustering submissions into programs...")

        idx_to_cluster, cluster_info = cluster_by_date(rows, timestamp_field, gap_weeks=2)

        if cluster_info:
            print(f"\nDetected {len(cluster_info)} programs:")
            for cluster_num, info in cluster_info.items():
                print(f"  Program {cluster_num}: {info['name']}")
                print(f"    Period: {info['start'].strftime('%m/%d/%Y')} to {info['end'].strftime('%m/%d/%Y')}")
                print(f"    Students: {info['count']}")
    else:
        print("\nWarning: Could not detect timestamp column. Program detection disabled.")

    # Find question columns
    question_cols = detect_question_columns(headers)
    if not question_cols:
        print("\nError: Could not find any question columns in the CSV!")
        return

    print(f"\nDetected {len(question_cols)} question columns")
    print(f"First question column: '{question_cols[0]}'")
    print(f"Last question column: '{question_cols[-1]}'")

    # Find answer key
    answer_key_idx, answer_key_name = find_answer_key(rows, name_field)
    if answer_key_idx is None:
        print("\nError: Could not find answer key row!")
        print("Looking for row with 'testing', 'answer', or 'key' in the name field.")
        return

    print(f"Answer key found: '{answer_key_name}' at row {answer_key_idx + 2} (Excel row)")

    # Load group definitions
    print("\n" + "=" * 60)
    print("LOADING GROUP DEFINITIONS")
    print("=" * 60)
    group_definitions = load_group_definitions()
    if group_definitions:
        print(f"\nLoaded {len(group_definitions)} groups:")
        for group_name, students in group_definitions.items():
            print(f"  {group_name}: {len(students)} students")
    else:
        print("\nNo group definitions loaded. Results will not be grouped.")

    # Extract answer key
    answer_key = {}
    answer_key_row = rows[answer_key_idx]
    for i, col in enumerate(question_cols, 1):
        answer_key[i] = answer_key_row[col].strip()

    # Ask user for filtering options
    print("\n" + "=" * 60)
    print("FILTER OPTIONS")
    print("=" * 60)

    # Ask about program filtering
    filter_by_program = None
    if cluster_info:
        print("\nWould you like to filter by program?")
        for cluster_num, info in cluster_info.items():
            print(f"  {cluster_num}. {info['name']}")
        print(f"  0. All programs")

        try:
            choice = input("\nEnter program number (or press Enter for all): ").strip()
            if choice and choice != '0':
                filter_by_program = int(choice)
                if filter_by_program not in cluster_info:
                    print("Invalid program number. Processing all programs.")
                    filter_by_program = None
        except ValueError:
            print("Invalid input. Processing all programs.")

    # Get starting student from user
    print("\n" + "=" * 60)
    starting_name = input("Enter the name of the student to start from\n(or press Enter to check all students): ").strip()

    # Find starting index
    start_idx = 0
    if starting_name:
        start_idx = find_student_index(rows, starting_name, name_field)
        if start_idx == -1:
            print(f"\nWarning: Student '{starting_name}' not found in answers.csv")
            print("Processing all students instead...")
            start_idx = 0
        else:
            actual_name = rows[start_idx][name_field].strip()
            print(f"\nFound '{actual_name}' at row {start_idx + 2} (Excel row).")
            print(f"Processing from there...\n")

    # First pass: Find the latest submission for each student
    student_latest_idx = {}  # Map normalized name to latest row index

    for idx in range(start_idx, len(rows)):
        row = rows[idx]
        student_name = row[name_field].strip()

        # Skip empty names and answer key
        if not student_name or idx == answer_key_idx:
            continue

        norm_name = normalize_name(student_name)
        # Always update to latest index (since we're going chronologically)
        student_latest_idx[norm_name] = idx

    # Second pass: Process only the latest submission for each student
    # Sort by index to maintain chronological order
    results = []
    program_results = defaultdict(list)  # Organize by program
    group_results = defaultdict(list)  # Organize by group

    for norm_name, idx in sorted(student_latest_idx.items(), key=lambda x: x[1]):
        row = rows[idx]
        student_name = row[name_field].strip()

        # Filter by program if requested
        student_program = idx_to_cluster.get(idx)
        if filter_by_program and student_program != filter_by_program:
            continue

        # Check answers
        missed_questions = []
        for i, col in enumerate(question_cols, 1):
            student_answer = row[col].strip()
            if student_answer != answer_key[i]:
                missed_questions.append(str(i))

        if missed_questions:
            result = f"{student_name}: {', '.join(missed_questions)}"
        else:
            result = f"{student_name}: All correct!"

        results.append(result)

        # Also organize by program
        if student_program:
            program_results[student_program].append(result)

        # Organize by group if group definitions are loaded
        if group_definitions:
            student_group = find_student_group(student_name, group_definitions)
            group_results[student_group].append(result)

    # Write results to file
    output_file = 'results.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"=== Exam Results ===\n")
        f.write(f"Name column: {name_field}\n")
        f.write(f"Number of questions: {len(question_cols)}\n")
        if filter_by_program:
            f.write(f"Filtered by: {cluster_info[filter_by_program]['name']}\n")
        if starting_name:
            f.write(f"Starting from: {starting_name}\n")
        f.write(f"Total students checked: {len(results)}\n")
        f.write(f"=" * 60 + "\n\n")

        # Write results organized by group if group definitions exist
        if group_definitions and group_results:
            # Define group order (groups first, then private)
            def get_group_sort_key(group_name):
                """Sort groups numerically, then private sessions, then ungrouped"""
                if group_name.lower().startswith('group '):
                    try:
                        return (0, int(group_name.split()[1]))
                    except (IndexError, ValueError):
                        return (0, 999)
                elif group_name.lower().startswith('private '):
                    try:
                        return (1, int(group_name.split()[1]))
                    except (IndexError, ValueError):
                        return (1, 999)
                else:  # Ungrouped
                    return (2, 0)

            for group_name in sorted(group_results.keys(), key=get_group_sort_key):
                if group_results[group_name]:  # Only show groups with students
                    f.write(f"\n{'=' * 60}\n")
                    f.write(f"{group_name}\n")
                    f.write(f"Students: {len(group_results[group_name])}\n")
                    f.write(f"{'=' * 60}\n\n")
                    for result in group_results[group_name]:
                        f.write(result + '\n')
        # Write results organized by program
        elif cluster_info and not filter_by_program:
            for cluster_num in sorted(program_results.keys()):
                info = cluster_info[cluster_num]
                f.write(f"\n{'=' * 60}\n")
                f.write(f"{info['name']}\n")
                f.write(f"Period: {info['start'].strftime('%m/%d/%Y')} to {info['end'].strftime('%m/%d/%Y')}\n")
                f.write(f"Students: {len(program_results[cluster_num])}\n")
                f.write(f"{'=' * 60}\n\n")
                for result in program_results[cluster_num]:
                    f.write(result + '\n')
        else:
            # Write all results
            for result in results:
                f.write(result + '\n')

    # Display results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    if group_definitions and group_results:
        # Display organized by group
        def get_group_sort_key(group_name):
            """Sort groups numerically, then private sessions, then ungrouped"""
            if group_name.lower().startswith('group '):
                try:
                    return (0, int(group_name.split()[1]))
                except (IndexError, ValueError):
                    return (0, 999)
            elif group_name.lower().startswith('private '):
                try:
                    return (1, int(group_name.split()[1]))
                except (IndexError, ValueError):
                    return (1, 999)
            else:  # Ungrouped
                return (2, 0)

        for group_name in sorted(group_results.keys(), key=get_group_sort_key):
            if group_results[group_name]:  # Only show groups with students
                print(f"\n{'=' * 60}")
                print(f"{group_name}")
                print(f"Students: {len(group_results[group_name])}")
                print(f"{'=' * 60}\n")
                for result in group_results[group_name]:
                    print(result)
    elif cluster_info and not filter_by_program:
        # Display organized by program
        for cluster_num in sorted(program_results.keys()):
            info = cluster_info[cluster_num]
            print(f"\n{'=' * 60}")
            print(f"{info['name']}")
            print(f"Period: {info['start'].strftime('%m/%d/%Y')} to {info['end'].strftime('%m/%d/%Y')}")
            print(f"Students: {len(program_results[cluster_num])}")
            print(f"{'=' * 60}\n")
            for result in program_results[cluster_num]:
                print(result)
    else:
        # Display all results
        for result in results:
            print(result)

    print("\n" + "=" * 60)
    print(f"Total students checked: {len(results)}")
    print(f"Results saved to: {output_file}")
    print("=" * 60)

if __name__ == "__main__":
    main()
