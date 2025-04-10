-- Direct SQL update to remove the @ symbol from the beginning of Instagram handles
UPDATE groups
SET instagram = SUBSTRING(instagram, 2)
WHERE instagram LIKE '@%'; 