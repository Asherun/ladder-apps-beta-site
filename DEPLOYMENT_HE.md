# פריסת אתר התמיכה והבטא

האתר סטטי ומתאים ל-GitHub Pages או ל-Codex Sites. n8n נשאר מקומי ואינו נחשף דרך האתר.

## בנייה

```bash
LADDER_SUPPORT_EMAIL="approved-public-address@example.com" \
python3 AppSupportSite/build_site.py --output /tmp/LadderSupportSite
```

יש לפרסם רק את תיקיית הפלט. כתובת התמיכה מוזרקת בזמן הבנייה ואינה נשמרת בקוד המקור. הבנייה חוסמת קובצי מקור של אפליקציות, פרויקטי Xcode, תיקיות Git, מפתחות, כתובות מקומיות וקישורי TestFlight ציבוריים.

## GitHub Pages - מסלול מומלץ

1. יוצרים repository ייעודי ומעלים אליו את תוכן `AppSupportSite`, ללא נתוני בודקים.
2. ב-`Settings > Secrets and variables > Actions` מוסיפים secret בשם `LADDER_SUPPORT_EMAIL` ובו כתובת התמיכה הציבורית המאושרת.
3. ב-`Settings > Pages > Build and deployment` בוחרים `GitHub Actions`.
4. דוחפים ל-`main` או מריצים ידנית את `Deploy Ladder beta site`.
5. מאמתים שהנתיב `/beta/` זמין ושאין קישורי TestFlight ציבוריים.
6. מאמתים שהנתיבים `/privacy/` ו-`/terms/` זמינים ללא התחברות.

ה-workflow ב-`.github/workflows/pages.yml` בונה את האתר לתיקייה זמנית, מעלה רק את הפלט הציבורי ומפרסם אותו ל-GitHub Pages.

## Codex Sites

ניתן לפרסם את אותה תיקיית פלט כאתר סטטי. לפני פרסום יש להגדיר את כתובת התמיכה הציבורית ולבצע בדיקת מובייל, נגישות ושליחת טופס. אין צורך לשנות את קוד האתר.

## גבול פרטיות

- טופס ההרשמה מכין הודעת דוא״ל מקומית ואינו שולח מידע לשרת האתר.
- רשימות CSV נשמרות מחוץ ל-repository ומועלות ידנית ל-App Store Connect.
- אין לפרסם את n8n, מפתחות API, כתובות Apple ID או פרטי בודקים.

## קישורים ל-App Store Connect ולאפליקציות

לאחר קביעת כתובת האתר הציבורית, יש להשתמש בכתובות הבאות בכל שלוש האפליקציות:

- `Privacy Policy URL`: `https://<public-domain>/privacy/`
- קישור תנאי שימוש במסך הרכישה/המנוי ובמסך ההגדרות: `https://<public-domain>/terms/`
- `Support URL`: דף המשחק המתאים, למשל `https://<public-domain>/math/`

ב-tvOS יש להזין ב-App Store Connect גם את טקסט מדיניות הפרטיות בשדה `Apple TV Privacy Policy`. אם לא מוגדר EULA מותאם אישית, Apple מחילה את ה-Standard EULA; עמוד תנאי השימוש באתר מפנה אליו ואינו מחליף אותו.

לפני הפצה יש לוודא שהקישורים לפרטיות ולתנאי שימוש נגישים גם מתוך האפליקציה. הדבר חשוב במיוחד במסכי מנוי מתחדש.
