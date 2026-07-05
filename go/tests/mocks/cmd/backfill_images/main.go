// backfill_images updates physioexercise.imagestoragepath in-place for records
// whose name matches a PNG in ExerciseImagesDir. Use it after re-seeding or
// when new images are dropped into /data/l8files/exercise-images/1.
//
// Uses direct Postgres access rather than the physio HTTP API so the server
// doesn't need to be running.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"

	_ "github.com/lib/pq"
	"github.com/lowenthalh-glitch/l8physio/go/tests/mocks"
)

func main() {
	host := flag.String("host", "127.0.0.1", "Postgres host")
	port := flag.String("port", "5432", "Postgres port")
	user := flag.String("user", "admin", "Postgres user")
	pass := flag.String("password", "admin", "Postgres password")
	dbname := flag.String("db", "admin", "Postgres database")
	imagesDir := flag.String("images", "", "Override exercise images directory (default /data/l8files/exercise-images/1)")
	dryRun := flag.Bool("dry-run", false, "Print planned updates without executing")
	force := flag.Bool("force", false, "Overwrite existing non-empty imagestoragepath values")
	flag.Parse()

	if *imagesDir != "" {
		mocks.ExerciseImagesDir = *imagesDir
	}

	idx := mocks.BuildExerciseImageIndex()
	if len(idx) == 0 {
		log.Fatalf("no images loaded from %s", mocks.ExerciseImagesDir)
	}
	fmt.Printf("Loaded %d images from %s\n", len(idx), mocks.ExerciseImagesDir)

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		*host, *port, *user, *pass, *dbname)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	rows, err := db.Query(`SELECT exerciseid, name, COALESCE(imagestoragepath, '') FROM physioexercise`)
	if err != nil {
		log.Fatalf("select: %v", err)
	}

	type row struct{ id, name, path string }
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.name, &r.path); err != nil {
			log.Fatalf("scan: %v", err)
		}
		all = append(all, r)
	}
	rows.Close()

	var matched, skipped, unmatched, updated int
	for _, r := range all {
		path := mocks.LookupImagePath(r.name)
		if path == "" {
			unmatched++
			fmt.Printf("  no image for: %s (%s)\n", r.name, r.id)
			continue
		}
		matched++
		if r.path != "" && !*force {
			skipped++
			continue
		}
		if r.path == path {
			continue
		}
		if *dryRun {
			fmt.Printf("  would set %s -> %s\n", r.name, path)
			continue
		}
		if _, err := db.Exec(
			`UPDATE physioexercise SET imagestoragepath = $1 WHERE exerciseid = $2`,
			path, r.id,
		); err != nil {
			log.Fatalf("update %s: %v", r.id, err)
		}
		updated++
	}

	fmt.Printf("\nSummary: %d exercises total, %d matched an image (%d unmatched), %d updated, %d already-set (use -force to overwrite)\n",
		len(all), matched, unmatched, updated, skipped)
}
