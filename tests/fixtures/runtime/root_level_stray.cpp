// A top-level statement cut by a closing brace is dropped with the brace.
//@line 999
double a = 1;
double lost = 2 }
double b = 3;
double alsoLost = 4
}
double c = a + b;
