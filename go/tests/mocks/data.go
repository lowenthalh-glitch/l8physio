package mocks

// data.go — physio-specific name arrays for mock data generation

var (
	// Patient first/last names (shared with utils firstNames/lastNames concept)
	patientFirstNames = []string{
		"James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
		"David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
		"Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
		"Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Emily", "Ashley",
	}

	patientLastNames = []string{
		"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
		"Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas",
		"Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
		"Harris", "Sanchez", "Clark", "Lewis", "Robinson", "Walker", "Hall", "Young",
	}

	// Diagnoses commonly treated in physiotherapy
	diagnoses = []string{
		"Lumbar disc herniation",
		"Rotator cuff tear",
		"ACL reconstruction recovery",
		"Chronic low back pain",
		"Cervical spondylosis",
		"Frozen shoulder (adhesive capsulitis)",
		"Knee osteoarthritis",
		"Plantar fasciitis",
		"Tennis elbow (lateral epicondylitis)",
		"Stroke rehabilitation",
		"Hip replacement recovery",
		"Sciatica",
		"Carpal tunnel syndrome",
		"Meniscus tear recovery",
		"Shoulder impingement syndrome",
	}

	// Referral sources
	referralSources = []string{
		"GP Referral",
		"Specialist Referral",
		"Self-referral",
		"Insurance",
		"Hospital Discharge",
		"Worker's Compensation",
		"Sports Club",
		"Online Search",
	}

	// Exercise names by category
	strengthExercises = []string{
		"Quadriceps Strengthening",
		"Gluteal Bridge",
		"Calf Raises",
		"Shoulder Press",
		"Bicep Curls",
		"Wall Squat",
		"Resistance Band Row",
		"Hip Abductor Strengthening",
	}

	flexibilityExercises = []string{
		"Hamstring Stretch",
		"Hip Flexor Stretch",
		"Chest Opener Stretch",
		"Cervical Lateral Flexion",
		"Piriformis Stretch",
		"Calf Stretch",
		"Thoracic Rotation Stretch",
	}

	balanceExercises = []string{
		"Single Leg Stand",
		"Tandem Walking",
		"Balance Board Training",
		"BOSU Ball Balance",
		"Heel-to-Toe Walk",
	}

	cardioExercises = []string{
		"Stationary Bike",
		"Treadmill Walking",
		"Aquatic Walking",
		"Elliptical Training",
	}

	mobilityExercises = []string{
		"Shoulder Pendulum",
		"Ankle Circles",
		"Wrist Flexion / Extension",
		"Cervical Rotation",
		"Hip Circles",
		"Thoracic Mobility Extension",
	}

	breathingExercises = []string{
		"Diaphragmatic Breathing",
		"Pursed Lip Breathing",
		"Intercostal Stretch Breathing",
	}

	// Treatment plan titles
	planTitles = []string{
		"Post-Surgical Knee Rehabilitation",
		"Lumbar Stabilisation Program",
		"Shoulder Mobility Restoration",
		"Hip Strengthening Protocol",
		"Cervical Pain Management",
		"Ankle Sprain Recovery",
		"Upper Limb Neurological Rehab",
		"Chronic Back Pain Management",
		"Sports Injury Return-to-Play",
		"Post-Stroke Functional Rehab",
		"Rotator Cuff Repair Recovery",
		"ACL Post-Op Rehabilitation",
		"Osteoarthritis Maintenance Plan",
		"Balance and Falls Prevention",
		"Workplace Injury Recovery",
	}

	// Appointment locations
	appointmentLocations = []string{
		"Room 1 - Gym",
		"Room 2 - Treatment",
		"Room 3 - Hydrotherapy",
		"Room 4 - Assessment",
		"Home Visit",
		"Telehealth",
	}

	// General notes for progress logs
	progressNotes = []string{
		"Patient reports improvement in pain levels.",
		"Good compliance with home exercise program.",
		"Some difficulty with range of motion exercises.",
		"Patient motivated and engaged during session.",
		"Reported soreness following last session — reduced intensity today.",
		"Excellent progress this week.",
		"Functional goals nearly achieved.",
		"Minor setback — increased pain due to activity at work.",
		"Patient demonstrated correct technique for all exercises.",
		"Reassessed and updated exercise parameters.",
	}
)
