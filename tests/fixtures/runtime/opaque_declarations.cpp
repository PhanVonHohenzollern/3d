// Opaque project declarations are accepted as unset variables.
//@line 999
GRUNDFOSBlockCreator oBlkCreator(pDb, "name");
AcGePoint3d acPt;
AcDbObjectId id = someCall();
CString text("x");
MyClass *ptr = new MyClass();
double used = 1;
oBlkCreator.create(used);
ptr->run();
double after = used + 1;
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(after, 0, 0), 1, 1, 3);
foo(oBlkCreator, acPt);
