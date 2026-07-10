-- 1. Drop trigger and function
DROP TRIGGER IF EXISTS syllabus_topics_search_vec_update ON syllabus_topics;
DROP FUNCTION IF EXISTS update_syllabus_topics_search_vec();

-- 2. Drop the column
ALTER TABLE "syllabus_topics" DROP COLUMN IF EXISTS "description";

-- 3. Re-create the function and trigger without description
CREATE FUNCTION update_syllabus_topics_search_vec() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vec := to_tsvector('english', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER syllabus_topics_search_vec_update
  BEFORE INSERT OR UPDATE OF title
  ON syllabus_topics FOR EACH ROW
  EXECUTE FUNCTION update_syllabus_topics_search_vec();
